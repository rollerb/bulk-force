const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai')
const request = require('request');
const chance = require('chance').Chance();
const salesforceBulk = require('../../lib/salesforce-bulk-api');
const fs = require('fs');
const Readable = require('stream').Readable;
const resultBuilder = require('../../lib/bulk-result-builder');

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
            opts.externalIdFieldName = chance.word();
        });

        it('should create job and return job info', (done) => {
            // given data
            var expectedJobInfo = { id: chance.string() };

            // given mocks
            sandbox.stub(request, 'post').withArgs(sinon.match.string, sinon.match({
                body: {
                    operation: opts.operation,
                    object: opts.object,
                    contentType: opts.contentType,
                    externalIdFieldName: opts.externalIdFieldName
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
            checkInvalidStatusCode({
                action: 'create job',
                process: cb => {
                    salesforceBulk.createJob(opts, cb);
                }
            }, done);
        });

        it('should fail with error message when unexpected request error', (done) => {
            checkUnexpectedException({
                action: 'create job',
                process: cb => {
                    salesforceBulk.createJob(opts, cb);
                }
            }, done);
        });
    });

    describe('#getJobDetails(auth, jobId, cb)', () => {
        it('should get job details', (done) => {
            // given data
            var jobId = chance.string();
            var expectedJobInfo = { id: jobId };

            // given mocks
            sandbox.stub(request, 'get').yields(null, {
                statusCode: 200
            }, expectedJobInfo);

            // when
            salesforceBulk.getJobDetails(opts.auth, jobId, (err, jobInfo) => {
                jobInfo.should.equal(expectedJobInfo);
                done();
            });
        });

        it('should fail with error message when non-200 response', (done) => {
            checkInvalidStatusCode({
                action: 'get job details',
                method: 'get',
                process: cb => {
                    salesforceBulk.getJobDetails(opts.auth, chance.string(), cb);
                }
            }, done);
        });

        it('should fail with error message when unexpected request error', (done) => {
            checkUnexpectedException({
                action: 'get job details',
                method: 'get',
                process: cb => {
                    salesforceBulk.getJobDetails(opts.auth, chance.string(), cb);
                }
            }, done);
        });
    });

    describe('#closeJob(auth, jobId, cb)', () => {
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
            checkInvalidStatusCode({
                action: 'close job',
                process: cb => {
                    salesforceBulk.closeJob(opts.auth, chance.string(), cb);
                }
            }, done);
        });

        it('should fail with error message when unexpected request error', (done) => {
            checkUnexpectedException({
                action: 'close job',
                process: cb => {
                    salesforceBulk.closeJob(opts.auth, chance.string(), cb);
                }
            }, done);
        });
    });

    describe('#createBatch(opts, cb)', () => {
        beforeEach(() => {
            opts.jobId = chance.string();
        });

        context('JSON', () => {
            beforeEach(() => {
                opts.data = chance.n(chance.integer, 2);
            });

            it('should create JSON batch and return batch info', (done) => {
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
                checkInvalidStatusCode({
                    action: 'create batch',
                    process: cb => {
                        salesforceBulk.createBatch(opts, cb);
                    }
                }, done);
            });

            it('should fail with error message when unexpected request error', (done) => {
                checkUnexpectedException({
                    action: 'create batch',
                    process: cb => {
                        salesforceBulk.createBatch(opts, cb);
                    }
                }, done);
            });
        });

        context('CSV', () => {
            var csvFile;

            beforeEach(() => {
                csvFile = `${chance.word()}.csv`;
                opts.file = csvFile;
            });

            it('should create CSV batch and return batch info', (done) => {
                // given data
                var batchId = chance.word();
                var expectedBatchInfo = { id: batchId };

                var read = new Readable();
                read.push(chance.string());
                read.push(null);

                // given mocks
                sandbox.stub(fs, 'createReadStream')
                    .withArgs(csvFile)
                    .returns(read);

                sandbox.stub(request, 'post')
                    .withArgs(sinon.match.string, sinon.match({
                        body: read
                    }))
                    .yields(null, {
                        statusCode: 201
                    }, `<batchInfo><id>${batchId}</id></batchInfo>`);

                // when
                salesforceBulk.createBatch(opts, (err, batchInfo) => {
                    batchInfo.should.deep.equal(expectedBatchInfo);
                    done();
                });
            });

            it('should fail with error message when non-201 status code', (done) => {
                checkInvalidStatusCode({
                    action: 'create batch',
                    process: cb => {
                        salesforceBulk.createBatch(opts, cb);
                    }
                }, done);
            });

            it('should fail with error message when unexpected request error', (done) => {
                checkUnexpectedException({
                    action: 'create batch',
                    process: cb => {
                        salesforceBulk.createBatch(opts, cb);
                    }
                }, done);
            });
        });
    });

    describe('#completeBatch(opts, cb)', () => {
        beforeEach(() => {
            opts.jobId = chance.string();
            opts.batchId = chance.string();
            opts.frequency = 10;
        });

        it('should wait for batch to complete and return latest batch info', done => {
            // given data
            var expectedBatchInfo = { id: chance.string(), state: chance.pickone(['Completed', 'Failed', 'Not Processed']) };

            // given mocks
            var requestStub = sandbox.stub(request, 'get');
            requestStub.onCall(0).yields(null, {
                statusCode: 200
            }, {
                    state: 'InProgress'
                });
            requestStub.onCall(1).yields(null, {
                statusCode: 200
            }, expectedBatchInfo);

            // when
            salesforceBulk.completeBatch(opts, (err, batchInfo) => {
                batchInfo.should.equal(expectedBatchInfo);
                done();
            });
        });

        it('should convert xml response to json when content-type is xml', done => {
            // given data
            var batchId = chance.word();
            var state = chance.pickone(['Completed', 'Failed', 'Not Processed']);
            var expectedXmlBatchInfo = `<batchInfo xmlns="http://www.force.com/2009/06/asyncapi/dataload"><id>${batchId}</id><state>${state}</state></batchInfo>`;
            var expectedBatchInfo = { id: batchId, state };

            // given mocks
            sandbox.stub(request, 'get').yields(null, {
                statusCode: 200,
                headers: {
                    'content-type': 'application/xml'
                }
            }, expectedXmlBatchInfo);

            // when
            salesforceBulk.completeBatch(opts, (err, batchInfo) => {
                batchInfo.should.deep.equal(expectedBatchInfo);
                done();
            });
        });

        it('should fail with error message when non-200 status code', (done) => {
            checkInvalidStatusCode({
                action: 'get batch details',
                method: 'get',
                process: cb => {
                    salesforceBulk.completeBatch(opts, cb);
                }
            }, done);
        });

        it('should fail with error message when unexpected request error', (done) => {
            checkUnexpectedException({
                action: 'get batch details',
                method: 'get',
                process: cb => {
                    salesforceBulk.completeBatch(opts, cb);
                }
            }, done);
        });
    });

    describe('#getBatchResult(opts, cb)', () => {
        beforeEach(() => {
            opts.jobId = chance.word();
            opts.batchId = chance.word();
        });

        it('should get batch result', done => {
            // given data
            var bulkRequest = chance.word();
            var bulkResponse = chance.word();
            var expectedResult = chance.word();

            // given mocks
            var getStub = sandbox.stub(request, 'get');

            getStub.withArgs(sinon.match(new RegExp(`\/${opts.batchId}/request$`))).yields(null, {
                statusCode: 200
            }, bulkRequest);

            getStub.withArgs(sinon.match(new RegExp(`\/${opts.batchId}/result$`))).yields(null, {
                statusCode: 200
            }, bulkResponse);

            sandbox.stub(resultBuilder, 'build')
                .withArgs(bulkRequest, bulkResponse)
                .yields(null, expectedResult);

            // when
            salesforceBulk.getBatchResult(opts, (err, result) => {
                result.should.equal(expectedResult);
                done();
            });
        });

        it('should fail getting batch results with error message when error getting batch request', (done) => {
            // given data
            var expectedError = chance.string();

            // given mocks
            var getStub = sandbox.stub(request, 'get');

            getStub.withArgs(sinon.match(new RegExp(`\/${opts.batchId}/request$`))).yields(expectedError);

            getStub.withArgs(sinon.match(new RegExp(`\/${opts.batchId}/result$`))).yields(null, {
                statusCode: 200
            }, chance.word());

            // when
            salesforceBulk.getBatchResult(opts, err => {
                err.should.equal(`Failed to get batch result due to unexpected error: Failed to get batch request due to unexpected error: ${expectedError}`);
                done();
            });
        });

        it('should fail getting batch results with error message when non-200 status code', (done) => {
            // given data
            var expectedException = {
                exceptionCode: chance.string(),
                exceptionMessage: chance.string()
            };

            // given mocks
            var getStub = sandbox.stub(request, 'get');

            getStub.withArgs(sinon.match(new RegExp(`\/${opts.batchId}/request$`))).yields(null, {
                statusCode: 200
            }, chance.word());

            getStub.withArgs(sinon.match(new RegExp(`\/${opts.batchId}/result$`))).yields(null, {
                statusCode: 500
            }, expectedException);

            // when
            salesforceBulk.getBatchResult(opts, err => {
                err.should.equal(`Failed to get batch result. Error received: ${expectedException.exceptionCode}; ${expectedException.exceptionMessage}`);
                done();
            });
        });

        it('should fail getting batch results with error message when unexpected request error', (done) => {
            // given data
            var expectedError = chance.string();

            // given mocks
            var getStub = sandbox.stub(request, 'get');

            getStub.withArgs(sinon.match(new RegExp(`\/${opts.batchId}/request$`))).yields(null, {
                statusCode: 200
            }, chance.word());

            getStub.withArgs(sinon.match(new RegExp(`\/${opts.batchId}/result$`))).yields(expectedError);

            // when
            salesforceBulk.getBatchResult(opts, err => {
                err.should.equal(`Failed to get batch result due to unexpected error: ${expectedError}`);
                done();
            });
        });

        it('should fail getting batch results with error message when fails to build result', done => {
            // given data
            var expectedError = chance.string();

            // given mocks
            var getStub = sandbox.stub(request, 'get');

            getStub.withArgs(sinon.match(new RegExp(`\/${opts.batchId}/request$`))).yields(null, {
                statusCode: 200
            }, chance.word());

            getStub.withArgs(sinon.match(new RegExp(`\/${opts.batchId}/result$`))).yields(null, {
                statusCode: 200
            }, chance.word());

            sandbox.stub(resultBuilder, 'build').yields(expectedError);

            // when
            salesforceBulk.getBatchResult(opts, err => {
                err.should.equal(`Failed to get batch result due to unexpected error: ${expectedError}`);
                done();
            });            
        });
    });

    function checkInvalidStatusCode(opts, done) {
        // given data
        var expectedException = {
            exceptionCode: chance.string(),
            exceptionMessage: chance.string()
        };
        var method = opts.method || 'post';

        // given mocks
        sandbox.stub(request, method).yields(null, {
            statusCode: 500
        }, expectedException);

        // when
        opts.process(err => {
            err.should.equal(`Failed to ${opts.action}. Error received: ${expectedException.exceptionCode}; ${expectedException.exceptionMessage}`);
            done();
        });
    }

    function checkUnexpectedException(opts, done) {
        // given data
        var expectedError = chance.string();
        var method = opts.method || 'post';

        // given mocks
        sandbox.stub(request, method).yields(expectedError);

        // when
        opts.process(err => {
            err.should.equal(`Failed to ${opts.action} due to unexpected error: ${expectedError}`);
            done();
        });
    }
});