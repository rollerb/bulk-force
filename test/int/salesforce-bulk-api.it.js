const salesforceLogin = require('../../lib/salesforce-login-api');
const salesforceBulk = require('../../lib/salesforce-bulk-api');
const salesforceRest = require('../../lib/salesforce-rest-api');
const chance = require('chance').Chance();
const chai = require('chai');
const expect = chai.expect;

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
        it('create and complete JSON batch', (done) => {
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
                            { Name: "My Bulk Force Batch 0" },
                            { Name: "My Bulk Force Batch 1" }
                        ]
                    };

                    salesforceBulk.createBatch(opts, (err, batchInfo) => {
                        batchInfo.id.should.exist;

                        var opts = {
                            auth,
                            jobId: jobInfo.id,
                            batchId: batchInfo.id
                        };

                        salesforceBulk.completeBatch(opts, (err, batchInfo) => {
                            batchInfo.state.should.equal('Completed');

                            salesforceBulk.getBatchResult(opts, (err, result) => {
                                result.success.should.have.lengthOf(2);

                                salesforceBulk.closeJob(auth, jobInfo.id, err => {
                                    opts.object = 'Account';

                                    salesforceRest.deleteRecords(opts, result.success, err => {
                                        expect(err).to.not.exist;
                                        done();
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });

        it('create and complete CSV batch', (done) => {
            salesforceLogin.usernamePassword({}, (err, auth) => {
                var opts = {
                    auth,
                    operation: 'insert',
                    object: 'Account',
                    contentType: 'CSV'
                };

                salesforceBulk.createJob(opts, (err, jobInfo) => {
                    var opts = {
                        auth,
                        jobId: jobInfo.id,
                        file: `${process.cwd()}/test/int/data/test.csv`
                    };

                    salesforceBulk.createBatch(opts, (err, batchInfo) => {
                        batchInfo.id.should.exist;

                        var opts = {
                            auth,
                            jobId: jobInfo.id,
                            batchId: batchInfo.id
                        };

                        salesforceBulk.completeBatch(opts, (err, batchInfo) => {
                            batchInfo.state.should.equal('Completed');

                            salesforceBulk.getBatchResult(opts, (err, result) => {
                                result.success.should.have.lengthOf(2);

                                salesforceBulk.closeJob(auth, jobInfo.id, err => {
                                    opts.object = 'Account';

                                    salesforceRest.deleteRecords(opts, result.success, err => {
                                        expect(err).to.not.exist;
                                        done();
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    })
});