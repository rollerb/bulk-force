"use strict";

/** @namespace bulk-force */

const bulkApi = require('./salesforce-bulk-api');
const loginApi = require('./salesforce-login-api');
const debug = require('debug')('bulk-force:bulk-force');
const info = require('debug')('bulk-force-info:bulk-force');
const batchSplitter = require('./bulk-batch-splitter');
const batchResultJoiner = require('./bulk-batch-result-joiner');
const dataMapper = require('./bulk-data-mapper');
const async = require('async');
const merge = require('merge');
const fs = require('fs');
const json2csv = require('json2csv');
const ProgressBar = require('progress');

function createLoadError(reason, err) {
    return createError('load data', reason, err);
}

function createQueryError(reason, err) {
    return createError('query data', reason, err);
}

function createError(action, reason, err) {
    return `Unable to ${action} due to failure to ${reason}: ${err}`;
}

function processBatch(batchOpts, cb) {
    bulkApi.createBatch(batchOpts, (err, batchInfo) => {
        if (err) return cb(err);

        debug('created batch %s', batchInfo.id);

        var jobBatchInfo = {
            auth: batchOpts.auth,
            jobId: batchOpts.jobId,
            batchId: batchInfo.id
        };
        bulkApi.completeBatch(jobBatchInfo, (err, batchInfo) => {
            if (err) return cb(err);

            debug('batch %s completed', batchInfo.id);

            bulkApi.getBatchResult(jobBatchInfo, (err, result) => {
                if (err) return cb(err);

                debug('received results for batch %s', batchInfo.id);
                cb(null, result);
            });
        })
    });
}

function processLoad(opts, data, cb) {
    var contentType;    

    if (typeof (data) === 'string') {
        contentType = 'CSV';
    } else {
        contentType = 'JSON';
    }

    batchSplitter.split({
        contentType,
        maxBatchSize: opts.maxBatchSize
    }, data, (err, batches) => {
        if (err) return cb(createLoadError('split job into multiple batches', err));

        bulkApi.createJob({
            auth: opts.auth,
            operation: opts.action,
            object: opts.object,
            externalIdFieldName: opts.externalField,
            contentType: 'JSON'
        }, (err, jobInfo) => {
            if (err) return cb(createLoadError('create job', err));

            debug('created job %s', jobInfo.id);

            var batchOpts = {
                auth: opts.auth,
                jobId: jobInfo.id,
                contentType: 'JSON'
            };
            var bar = new ProgressBar('  batches [:bar] :current/:total :percent :etas', {
                total: batches.length
            });

            async.map(batches, (batch, callback) => {
                let data = batch;

                if(opts.mapFile) {
                    try {
                        data = dataMapper.map(opts.mapFile, data);
                    } catch(e) {
                        return callback(createLoadError('process mapping file', e));
                    }
                }
                processBatch(merge(true, batchOpts, { data }), (err, batchResult) => {
                    bar.tick();
                    callback(err, batchResult);
                });
            }, (err, results) => {
                if (err) {
                    err = createLoadError('process batch', err);
                }

                bulkApi.closeJob(opts.auth, jobInfo.id, closeJobError => {
                    if (closeJobError) {
                        var formattedError = `Unable to close job: ${closeJobError}`;

                        if (err) {
                            cb(`${err}; ${formattedError}`);
                        } else {
                            cb(formattedError);
                        }
                    } else if (err) {
                        cb(err);
                    } else {
                        var joinedResults = batchResultJoiner.joinInputResults(results);

                        if (opts.toPath) {
                            var resultSummary = {
                                successCount: joinedResults.success.length,
                                errorCount: joinedResults.error.length
                            };
                            var path = `${opts.toPath}/${opts.object}`;

                            saveResults(`${path}_success.csv`, joinedResults.success, err => {
                                if (err) {
                                    cb(`Unable to save success file: ${err}`);
                                } else {
                                    saveResults(`${path}_error.csv`, joinedResults.error, err => {
                                        if (err) {
                                            cb(`Unable to save error file: ${err}`);
                                        } else {
                                            cb(null, resultSummary);
                                        }
                                    });
                                }
                            });
                        } else {
                            cb(null, joinedResults);
                        }
                    }
                })
            });
        });
    });
}

/**
 * Bulk load data into Salesforce.
 * 
 * @param {object} opts bulk loading options
 * @param {string} opts.action the load action
 * @param {string} opts.object the Salesforce object to load data into
 * @param {string} [opts.externalField] external field to use when upserting
 * @param {number} [opts.maxBatchSize] the maximum size of a batch; defaults to 2000
 * @param {string} [opts.mapFile] mapping file to use to map field names or hardcoded values
 * @param {string} [opts.toPath] folder path where results should be saved
 * @param {auth} [opts.auth] the OAuth2 information
 * @param {object[]|string} data array of same kind of object, or CSV file location
 * @param {function(string, object)} cb
 */
function load(opts, data, cb) {
    if (opts.auth) {
        processLoad(opts, data, cb);
    } else {
        loginApi.usernamePassword({}, (err, auth) => {
            opts.auth = auth;
            processLoad(opts, data, cb);
        });
    }
}

function saveResults(file, result, cb) {
    if (result.length === 0) {
        debug('no results to save to %s', file);
        cb();
    } else {
        debug('saving results to %s', file);
        fs.writeFile(file, json2csv({ data: result }), err => {
            if (err) {
                cb(err);
            } else {
                cb(null, {
                    recordCount: result.length
                });
            }
        });
    }
}

function processQuery(opts, soql, cb) {
    bulkApi.createJob({
        auth: opts.auth,
        operation: 'query',
        object: opts.object,
        contentType: 'CSV'
    }, (err, jobInfo) => {
        if (err) return cb(createQueryError('create job', err));

        debug('created job %s', jobInfo.id);

        var batchOpts = {
            auth: opts.auth,
            jobId: jobInfo.id,
            query: soql,
            toFile: opts.toFile
        };
        processBatch(batchOpts, (processBatchError, result) => {
            bulkApi.closeJob(opts.auth, jobInfo.id, closeJobError => {
                if (closeJobError) {
                    var formattedJobError = `Unable to close job: ${closeJobError}`;

                    if (processBatchError) {
                        var formattedBatchError = createQueryError('process batch', processBatchError);
                        cb(`${formattedBatchError}; ${formattedJobError}`);
                    } else {
                        cb(formattedJobError, result);
                    }
                } else if (processBatchError) {
                    cb(createQueryError('process batch', processBatchError));
                } else {
                    if (opts.toFile) {
                        saveResults(opts.toFile, result, cb);
                    } else {
                        cb(null, result);
                    }
                }
            });
        });
    });
}

/**
 * Bulk query data from Salesforce.
 * 
 * @param {object} opts bulk loading options
 * @param {string} opts.object the Salesforce object to query
 * @param {string} [opts.toFile] file where the SOQL result should be saved
 * @param {auth} [opts.auth] the OAuth2 information
 * @param {string} soql SOQL to execute
 * @param {function(string, object)} cb
 */
function query(opts, soql, cb) {
    if (opts.auth) {
        processQuery(opts, soql, cb);
    } else {
        loginApi.usernamePassword({}, (err, auth) => {
            opts.auth = auth;
            processQuery(opts, soql, cb);
        });
    }
}

module.exports = {
    load,
    query
}