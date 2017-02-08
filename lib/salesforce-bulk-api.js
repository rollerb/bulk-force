"use strict";

const request = require('request');
const fs = require('fs');
const xml2js = require('xml2js');
const xmlParse = xml2js.parseString;
const debug = require('debug')('bulk-force:bulk-api');
const info = require('debug')('bulk-force-info:bulk-api');
const error = require('debug')('bulk-force:bulk-api:error');
const resultBuilder = require('./bulk-result-builder');
const csv = require('csvtojson');
const merge = require('merge');
const resultJoiner = require('./bulk-batch-result-joiner');
const async = require('async');

const JOB_PATH = '/services/async/38.0/job';
const XML_OPTS = {
    explicitRoot: false,
    explicitArray: false,
    ignoreAttrs: true
};

function createJob(opts, cb) {
    request.post(opts.auth.instanceUrl + JOB_PATH, {
        json: true,
        headers: createAuthHeader(opts.auth),
        body: {
            operation: opts.operation,
            object: opts.object,
            contentType: opts.contentType,
            externalIdFieldName: opts.externalIdFieldName
        }
    }, (err, http, body) => {
        handleResponse({
            err, http, body,
            expectedStatusCode: 201,
            action: 'create job'
        }, cb);
    });
}

function getJobDetails(auth, jobId, cb) {
    request.get(auth.instanceUrl + JOB_PATH + `/${jobId}`, {
        json: true,
        headers: createAuthHeader(auth)
    }, (err, http, body) => {
        handleResponse({
            err, http, body,
            expectedStatusCode: 200,
            action: 'get job details'
        }, cb);
    });
}

function closeJob(auth, jobId, cb) {
    request.post(auth.instanceUrl + JOB_PATH + `/${jobId}`, {
        json: true,
        headers: createAuthHeader(auth),
        body: {
            state: 'Closed'
        }
    }, (err, http, body) => {
        handleResponse({
            err, http, body,
            expectedStatusCode: 200,
            action: 'close job'
        }, cb);
    });
}

function createBatch(opts, cb) {
    if (opts.data) {
        createJsonBatch(opts, cb);
    } else if (opts.file) {
        createCsvBatch(opts, cb);
    } else {
        createQueryBatch(opts, cb);
    }
}

function createJsonBatch(opts, cb) {
    request.post(`${opts.auth.instanceUrl}${JOB_PATH}/${opts.jobId}/batch`, {
        json: true,
        headers: createAuthHeader(opts.auth),
        body: opts.data
    }, (err, http, body) => {
        handleResponse({
            err, http, body,
            expectedStatusCode: 201,
            action: 'create batch'
        }, cb);
    });
}

function createCsvBatch(opts, cb) {
    var headers = createAuthHeader(opts.auth);
    headers['Content-Type'] = 'text/csv';

    debug('creating batch from file %s', opts.file);

    request.post(`${opts.auth.instanceUrl}${JOB_PATH}/${opts.jobId}/batch`, {
        headers,
        body: fs.createReadStream(opts.file)
    }, (err, http, body) => {
        handleResponse({
            err, http, body,
            expectedStatusCode: 201,
            action: 'create batch',
            transform: (body, callback) => {
                xmlParse(body, XML_OPTS, callback);
            }
        }, cb);
    });
}

function createQueryBatch(opts, cb) {
    var headers = createAuthHeader(opts.auth);
    headers['Content-Type'] = 'text/csv';

    request.post(`${opts.auth.instanceUrl}${JOB_PATH}/${opts.jobId}/batch`, {
        headers,
        body: opts.query
    }, (err, http, body) => {
        handleResponse({
            err, http, body,
            expectedStatusCode: 201,
            action: 'create batch',
            transform: (body, callback) => {
                xmlParse(body, XML_OPTS, callback);
            }
        }, cb);
    });
}

function completeBatch(opts, cb) {
    var endStates = ['Completed', 'Failed', 'Not Processed'];
    var frequency = opts.frequency || 2000;

    var id = setInterval(() => {
        getBatchDetails(opts, (err, batchInfo) => {
            if (err) {
                clearInterval(id);
                cb(err);
            } else if (endStates.indexOf(batchInfo.state) !== -1) {
                clearInterval(id);
                cb(null, batchInfo);
            } else {
                info('Pending state for batch %s: %O', opts.batchId, batchInfo);
            }
        });
    }, frequency);
}

function getBatchDetails(opts, cb) {
    request.get(`${opts.auth.instanceUrl}${JOB_PATH}/${opts.jobId}/batch/${opts.batchId}`, {
        json: true,
        headers: createAuthHeader(opts.auth)
    }, (err, http, body) => {
        handleResponse({
            err, http, body,
            expectedStatusCode: 200,
            action: 'get batch details',
            transform: (body, callback) => {
                if (http.headers && http.headers['content-type'] === 'application/xml') {
                    xmlParse(body, XML_OPTS, callback);
                } else {
                    callback(null, body);
                }
            }
        }, cb);
    });
}

function getBatchRequest(opts, cb) {
    request.get(`${opts.auth.instanceUrl}${JOB_PATH}/${opts.jobId}/batch/${opts.batchId}/request`, {
        json: true,
        headers: createAuthHeader(opts.auth)
    }, (err, http, body) => {
        handleResponse({
            err, http, body,
            expectedStatusCode: 200,
            action: 'get batch request'
        }, cb);
    });
}

function getBatchResult(opts, cb) {
    request.get(`${opts.auth.instanceUrl}${JOB_PATH}/${opts.jobId}/batch/${opts.batchId}/result`, {
        json: true,
        headers: createAuthHeader(opts.auth)
    }, (err, http, body) => {
        var action = 'get batch result';

        if (err) {
            cb(createUnexpectedError(action, err));
        } else if (http.statusCode != 200) {
            cb(createStatusCodeError(action, 200, http.statusCode, body));
        } else {
            if (http.headers && http.headers['content-type'] === 'application/xml') {
                getQueryBatchResult(opts, body, cb);
            } else {
                getInputBatchResult(opts, body, cb);
            }
        }
    });
}

function getBatchResultById(opts, cb) {
    var action = `get batch result ${opts.id}`;
    
    request.get(`${opts.auth.instanceUrl}${JOB_PATH}/${opts.jobId}/batch/${opts.batchId}/result/${opts.id}`, {
        headers: createAuthHeader(opts.auth)
    }, (err, http, body) => {
        handleResponse({
            err, http, body, action,
            expectedStatusCode: 200,
            transform: (body, callback) => {
                csv().fromString(body, (csvError, result) => {
                    if (csvError) {
                        callback(createUnexpectedError(action, csvError));
                    } else {
                        callback(null, result);
                    }
                });
            }
        }, cb);
    });
}

function getQueryBatchResult(opts, body, cb) {
    var action = 'get query batch result';
    var xmlOpts = {
        explicitRoot: false,
        ignoreAttrs: true
    };

    xml2js.parseString(body, xmlOpts, (err, bulkResponse) => {
        if (err) {
            cb(createUnexpectedError(action, err));
        } else {
            async.map(bulkResponse.result, (resultId, callback) => {
                let resultOpts = merge(true, opts, { id: resultId });
                getBatchResultById(resultOpts, callback);
            }, (err, results) => {
                if (err) {
                    cb(err);
                } else {
                    cb(null, resultJoiner.joinQueryResults(results));
                }
            });
        }
    });
}

function getInputBatchResult(opts, bulkResponse, cb) {
    var action = 'get input batch result';

    getBatchRequest(opts, (requestError, bulkRequest) => {
        if (requestError) {
            cb(createUnexpectedError(action, requestError));
        } else {
            resultBuilder.build(bulkRequest, bulkResponse, (err, result) => {
                if (err) {
                    cb(createUnexpectedError(action, err));
                } else {
                    cb(null, result);
                }
            });
        }
    });
}

function handleResponse(opts, callback) {
    if (opts.err) {
        callback(createUnexpectedError(opts.action, opts.err));
    } else if (opts.http.statusCode != opts.expectedStatusCode) {
        callback(createStatusCodeError(opts.action, opts.expectedStatusCode, opts.http.statusCode, opts.body));
    } else {
        debug('completed %s', opts.action);
        if (opts.transform) {
            opts.transform(opts.body, (err, result) => {
                callback(err, result);
            })
        } else {
            callback(null, opts.body);
        }
    }
}

function createStatusCodeError(action, expectedStatusCode, actualStatusCode, body) {
    error(`Received non-${expectedStatusCode} response code ${actualStatusCode} with the message: ${JSON.stringify(body)}`);
    return `Failed to ${action}. Error received: ${body.exceptionCode}; ${body.exceptionMessage}`;
}

function createUnexpectedError(action, err) {
    error('Unexpected request error:', err);
    return `Failed to ${action} due to unexpected error: ${err}`;
}

function createAuthHeader(auth) {
    return {
        'X-SFDC-Session': auth.accessToken
    };
}

module.exports = {
    createJob,
    getJobDetails,
    closeJob,
    createBatch,
    completeBatch,
    getBatchResult
};