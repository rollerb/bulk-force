/** @namespace bulk-force */

const bulkApi = require('./salesforce-bulk-api');
const loginApi = require('./salesforce-login-api');
const debug = require('debug')('bulk-force:bulk-force');
const info = require('debug')('bulk-force-info:bulk-force');
const batchSplitter = require('./bulk-batch-splitter');
const batchResultJoiner = require('./bulk-batch-result-joiner');
const async = require('async');
const merge = require('merge');
const fs = require('fs');
const json2csv = require('json2csv');

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

            async.map(batches, (batch, callback) => {
                processBatch(merge(true, batchOpts, { data: batch }), callback);
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
                        cb(null, batchResultJoiner.joinInputResults(results));
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
    debug('saving results to %s', file);
    fs.writeFile(file, json2csv({data: result}), err => {
        cb(null, {
            recordCount: result.length
        });
    });
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