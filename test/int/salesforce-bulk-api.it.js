const salesforceLogin = require('../../lib/salesforce-login-api');
const salesforceBulk = require('../../lib/salesforce-bulk-api');
const request = require('request');
const chai = require('chai');

chai.should();

describe('salesforce-bulk-api:integration', () => {
    describe('jobs', () => {
        it('#createJob(opts, cb)', (done) => {
            salesforceLogin.usernamePassword({}, (err, auth) => {
                var opts = {
                    auth,
                    operation: 'insert',
                    object: 'Account',
                    contentType: 'JSON'
                };

                salesforceBulk.createJob(opts, (err, jobInfo) => {
                    jobInfo.id.should.exist;

                    salesforceBulk.closeJob(auth, jobInfo.id, err => {
                        done();
                    });

                });
            });
        });
    });

    describe('batches', () => {
        it('#createBatch(opts, cb)', (done) => {
            salesforceLogin.usernamePassword({}, (err, auth) => {
                var opts = {
                    auth,
                    operation: 'insert',
                    object: 'Account',
                    contentType: 'JSON'
                };

                salesforceBulk.createJob(opts, (err, jobInfo) => {
                    var opts = {
                        auth,
                        jobId: jobInfo.id,
                        data: [
                            {Name: "My Bulk Force Batch 0"},
                            {Name: "My Bulk Force Batch 1"}                            
                        ]
                    };

                    salesforceBulk.createBatch(opts, (err, batchInfo) => {
                        batchInfo.id.should.exist;

                        salesforceBulk.closeJob(auth, jobInfo.id, err => {
                            done();
                        });
                    });
                });
            });
        });
    })
});