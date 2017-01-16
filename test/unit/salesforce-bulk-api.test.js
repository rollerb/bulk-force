const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai')
const request = require('request');
const chance = require('chance').Chance();
const salesforceBulk = require('../../lib/salesforce-bulk-api');

chai.should();
chai.use(sinonChai);

describe('salesforce-bulk-api:unit', () => {
    var sandbox = sinon.sandbox.create();
    var opts;

    afterEach(() => {
        sandbox.restore();
    });

    beforeEach(() => {
        opts = {
            auth: {
                accessToken: chance.string(),
                instanceUrl: chance.string()
            }
        };
    });

    describe('#createJob(opts, cb)', () => {
        beforeEach(() => {
            opts.operation = chance.word();
            opts.object = chance.word();
            opts.contentType = chance.word();
        });

        it('should create job and return job info', (done) => {
            // given data
            var expectedJobInfo = { id: chance.string() };

            // given mocks
            sandbox.stub(request, 'post').withArgs(sinon.match.string, sinon.match({
                body: {
                    operation: opts.operation,
                    object: opts.object,
                    contentType: opts.contentType
                }
            })).yields(null, {
                statusCode: 201
            }, expectedJobInfo);

            // when
            salesforceBulk.createJob(opts, (err, jobInfo) => {
                jobInfo.should.equal(expectedJobInfo);
                done();
            })
        });

        it('should fail with error message when non-201 response', (done) => {
            checkInvalidStatusCode('create job', cb => {
                salesforceBulk.createJob(opts, cb);
            }, done);
        });

        it('should fail with error message when unexpected request error', (done) => {
            checkUnexpectedException('create job', cb => {
                salesforceBulk.createJob(opts, cb);
            }, done);
        });
    });

    describe('#closeJob(id, cb)', () => {
        it('should close job', (done) => {
            // given data
            var jobId = chance.string();

            // given mocks
            var postStub = sandbox.stub(request, 'post').withArgs(sinon.match.string, sinon.match({
                body: {
                    state: 'Closed'
                }
            })).yields(null, {
                statusCode: 200
            }, {});

            // when
            salesforceBulk.closeJob(opts.auth, jobId, err => {
                postStub.should.have.been.called;
                done();
            })
        });

        it('should fail with error message when non-200 response', (done) => {
            checkInvalidStatusCode('close job', cb => {
                salesforceBulk.closeJob(opts.auth, chance.string(), cb);
            }, done);
        });

        it('should fail with error message when unexpected request error', (done) => {
            checkUnexpectedException('close job', cb => {
                salesforceBulk.closeJob(opts.auth, chance.string(), cb);
            }, done);
        });
    });

    describe('#createBatch(opts, cb)', () => {
        beforeEach(() => {
            opts.jobId = chance.string();
            opts.data = chance.n(chance.integer, 2);
        });

        it('should create batch and return batch info', (done) => {
            // given data
            var expectedBatchInfo = { id: chance.string() };

            // given mocks
            sandbox.stub(request, 'post').withArgs(sinon.match.string, sinon.match({
                body: opts.data
            })).yields(null, {
                statusCode: 201
            }, expectedBatchInfo);

            // when
            salesforceBulk.createBatch(opts, (err, batchInfo) => {
                batchInfo.should.equal(expectedBatchInfo);
                done();
            });
        });

        it('should fail with error message when non-201 status code', (done) => {
            checkInvalidStatusCode('create batch', cb => {
                salesforceBulk.createBatch(opts, cb);
            }, done);
        });

        it('should fail with error message when unexpected request error', (done) => {
            checkUnexpectedException('create batch', cb => {
                salesforceBulk.createBatch(opts, cb);
            }, done);
        });
    });

    function checkInvalidStatusCode(action, process, done) {
        // given data
        var expectedException = {
            exceptionCode: chance.string(),
            exceptionMessage: chance.string()
        };

        // given mocks
        sandbox.stub(request, 'post').yields(null, {
            statusCode: 500
        }, expectedException);

        // when
        process(err => {
            err.should.equal(`Failed to ${action}. Error received: ${expectedException.exceptionCode}; ${expectedException.exceptionMessage}`);
            done();
        });
    }

    function checkUnexpectedException(action, process, done) {
        // given data
        var expectedError = chance.string();

        // given mocks
        sandbox.stub(request, 'post').yields(expectedError);

        // when
        process(err => {
            err.should.equal(`Failed to ${action} due to unexpected error: ${expectedError}`);
            done();
        });        
    }
});