const bulkApi = require('./salesforce-bulk-api');
const loginApi = require('./salesforce-login-api');
const debug = require('debug')('bulk-force:bulk-force');

function processJob(opts, data, cb) {
    var contentType;
    if(typeof(data) === 'string') {
        contentType = 'CSV';
    } else {
        contentType = 'JSON';
    }

    bulkApi.createJob({
        auth: opts.auth,
        operation: opts.action,
        object: opts.object,
        contentType
    }, (err, jobInfo) => {
        var batchOpts = {
            auth: opts.auth,
            jobId: jobInfo.id
        };

        if(contentType === 'CSV') {
            batchOpts.file = data;
        } else {
            batchOpts.data = data;
        }

        bulkApi.createBatch(batchOpts, (err, batchInfo) => {
            bulkApi.closeJob(opts.auth, jobInfo.id, err => {
                var jobBatchInfo = {
                    auth: opts.auth,
                    jobId: jobInfo.id,
                    batchId: batchInfo.id
                };
                bulkApi.completeBatch(jobBatchInfo, (err, batchInfo) => {
                    bulkApi.getBatchResult(jobBatchInfo, (err, result) => {
                        cb(null, result);
                    });
                })
            });
        });
    });
}

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