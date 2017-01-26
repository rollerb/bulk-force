const bulkApi = require('./salesforce-bulk-api');
const debug = require('debug')('bulk-force:bulk-force');

function loadData(opts, data, cb) {
    bulkApi.createJob({
        auth: opts.auth,
        operation: opts.action,
        object: opts.object,
        contentType: 'JSON'
    }, (err, jobInfo) => {
        bulkApi.createBatch({
            auth: opts.auth,
            jobId: jobInfo.id,
            data
        }, (err, batchInfo) => {
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

module.exports = {
    loadData
}