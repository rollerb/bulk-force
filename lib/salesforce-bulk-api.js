const request = require('request');

const JOB_PATH = '/services/async/38.0/job';

function createJob(opts, cb) {
    request.post(opts.auth.instanceUrl + JOB_PATH, {
        json: true,
        headers: createAuthHeader(opts.auth),
        body: {
            operation: opts.operation,
            object: opts.object,
            contentType: opts.contentType
        }
    }, (err, http, body) => {
        handleResponse({
            err, http, body,
            expectedStatusCode: 201,
            action: 'create job'
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
    request.post(opts.auth.instanceUrl + JOB_PATH + `/${opts.jobId}/batch`, {
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

function handleResponse(opts, cb) {
    if (opts.err) {
        console.log('Unexpected request error:', opts.err);
        cb(`Failed to ${opts.action} due to unexpected error: ${opts.err}`);
    } else if (opts.http.statusCode != opts.expectedStatusCode) {
        console.error(`Received non-${opts.expectedStatusCode} response code ${opts.http.statusCode} with the message: ${JSON.stringify(opts.body)}`);
        cb(`Failed to ${opts.action}. Error received: ${opts.body.exceptionCode}; ${opts.body.exceptionMessage}`);
    } else {
        cb(null, opts.body);
    }
}

function createAuthHeader(auth) {
    return {
        'X-SFDC-Session': auth.accessToken
    };
}

exports.createJob = createJob;
exports.closeJob = closeJob;
exports.createBatch = createBatch;