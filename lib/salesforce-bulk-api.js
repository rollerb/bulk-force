const request = require('request');
const fs = require('fs');
const xmlParse = require('xml2js').parseString;
const debug = require('debug')('bulk-force:bulk-api');
const error = require('debug')('bulk-force:bulk-api:error');
const resultBuilder = require('./bulk-result-builder');

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
    } else {
        createCsvBatch(opts, cb);
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

function completeBatch(opts, cb) {
    var endStates = ['Completed', 'Failed', 'Not Processed'];
    var frequency = opts.frequency || 1000;

    var id = setInterval(() => {
        getBatchDetails(opts, (err, batchInfo) => {
            if (err) {
                clearInterval(id);
                cb(err);
            } else if (endStates.indexOf(batchInfo.state) !== -1) {
                clearInterval(id);
                cb(null, batchInfo);
            } else {
                debug('Pending state for batch %s: %O', opts.batchId, batchInfo);
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
    var action = 'get batch result';

    request.get(`${opts.auth.instanceUrl}${JOB_PATH}/${opts.jobId}/batch/${opts.batchId}/result`, {
        json: true,
        headers: createAuthHeader(opts.auth)
    }, (err, http, body) => {
        getBatchRequest(opts, (requestError, bulkRequest) => {
            if (requestError) {
                cb(createUnexpectedError(action, requestError));
            } else {
                handleResponse({
                    err, http, body,
                    expectedStatusCode: 200,
                    action,
                    transform: (bulkResponse, callback) => {
                        resultBuilder.build(bulkRequest, bulkResponse, (err, result) => {
                            if (err) {
                                callback(createUnexpectedError(action, err));
                            } else {
                                callback(null, result);
                            }
                        })
                    }
                }, cb);
            }
        });
    });
}

function handleResponse(opts, callback) {
    if (opts.err) {
        callback(createUnexpectedError(opts.action, opts.err));
    } else if (opts.http.statusCode != opts.expectedStatusCode) {
        error(`Received non-${opts.expectedStatusCode} response code ${opts.http.statusCode} with the message: ${JSON.stringify(opts.body)}`);
        callback(`Failed to ${opts.action}. Error received: ${opts.body.exceptionCode}; ${opts.body.exceptionMessage}`);
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