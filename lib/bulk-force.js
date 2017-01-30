/** @namespace bulk-force */

const bulkApi = require('./salesforce-bulk-api');
const loginApi = require('./salesforce-login-api');
const debug = require('debug')('bulk-force:bulk-force');
const batchSplitter = require('./bulk-batch-splitter');
const batchResultJoiner = require('./bulk-batch-result-joiner');
const async = require('async');

function populateTypeOfData(opts, data) {
    if (opts.contentType === 'CSV') {
        opts.file = data;
        debug('content type determined to be a CSV file');
    } else {
        opts.data = data;
        debug('content type determined to be JS array');
    }
}

function processBatch(batchOpts, data, cb) {
    populateTypeOfData(batchOpts, data);

    bulkApi.createBatch(batchOpts, (err, batchInfo) => {
        debug('created batch %s', batchInfo.id);

        var jobBatchInfo = {
            auth: batchOpts.auth,
            jobId: batchOpts.jobId,
            batchId: batchInfo.id
        };
        bulkApi.completeBatch(jobBatchInfo, (err, batchInfo) => {
            debug('batch %s completed', batchInfo.id);

            bulkApi.getBatchResult(jobBatchInfo, (err, result) => {
                debug('received results for batch %s', batchInfo.id);

                cb(null, result);
            });
        })
    });
}

function processJob(opts, data, cb) {
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
        debug('broke data into %d batches', batches.length);

        bulkApi.createJob({
            auth: opts.auth,
            operation: opts.action,
            object: opts.object,
            externalIdFieldName: opts.externalField,
            contentType
        }, (err, jobInfo) => {
            debug('created job %s', jobInfo.id);

            var batchOpts = {
                auth: opts.auth,
                jobId: jobInfo.id,
                contentType
            };

            async.map(batches, (batch, callback) => {
                processBatch(batchOpts, batch, callback);
            }, (err, results) => {
                bulkApi.closeJob(opts.auth, jobInfo.id, err => {
                    cb(null, batchResultJoiner.join(results));
                })
            });
        });
    });
}

/**
 * The OAuth2 security information.
 * 
 * @typedef auth
 * @type {object}
 * @property {string} instanceUrl - the salesforce org instance where data should be loaded
 * @property {string} accessToken - the OAuth2 access token
 */

/**
 * Data load callback.
 * 
 * @callback loadDataCallback
 * @param {string} err - error message
 * @param {object} result - the result of the data load
 * @param {object[]} result.success - the successly results
 * @param {object[]} result.error - the error results
 */

/**
 * Bulk load data into Salesforce.
 * 
 * @param {object} opts - bulk loading options
 * @param {string} opts.action - the load action
 * @param {string} opts.object - the Salesforce object to load data into
 * @param {auth} [opts.auth] - the OAuth2 information
 * @param {object[]|string} data - array of same kind of object, or CSV file location
 * @param {loadDataCallback} cb
 */
function loadData(opts, data, cb) {
    if (opts.auth) {
        processJob(opts, data, cb);
    } else {
        loginApi.usernamePassword({}, (err, auth) => {
            opts.auth = auth;
            processJob(opts, data, cb);
        });
    }
}

module.exports = {
    loadData
}