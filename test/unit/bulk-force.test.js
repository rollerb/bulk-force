const bulk = require('../../lib/bulk-force');
const expect = require('chai').expect;
const chance = require('chance').Chance();
const sinon = require('sinon');
const bulkApi = require('../../lib/salesforce-bulk-api');
const loginApi = require('../../lib/salesforce-login-api');
const batchSplitter = require('../../lib/bulk-batch-splitter');
const batchJoiner = require('../../lib/bulk-batch-result-joiner');
const proxyquire = require('proxyquire');
const dataMapper = require('../../lib/bulk-data-mapper');
const fs = require('fs');

describe('bulk force', () => {
    const sandbox = sinon.sandbox.create();

    var auth;
    var opts;

    chance.mixin({
        'jobInfo': () => {
            return { id: chance.word() };
        },
        'batchInfo': () => {
            return { id: chance.word() };
        }
    });

    afterEach(() => {
        sandbox.restore();
    });

    beforeEach(() => {
        auth = {
            instanceUrl: chance.word(),
            accessToken: chance.word()
        };

        opts = {
            action: chance.word(),
            object: chance.word(),
            externalField: chance.word(),
            auth
        };
    });

    describe('#load(opts, data, cb)', () => {
        context('single job, single batch', () => {
            var data;
            var expectedResult;
            var jobInfo;
            var batchInfo;

            beforeEach(() => {
                jobInfo = chance.jobInfo();
                batchInfo = chance.batchInfo();

                var jobBatchInfo = {
                    jobId: jobInfo.id,
                    batchId: batchInfo.id
                };

                data = chance.n(chance.word, 10);

                expectedResult = chance.n(chance.word, 10);

                sandbox.stub(bulkApi, 'createJob')
                    .withArgs(sinon.match({
                        operation: opts.action,
                        object: opts.object,
                        externalIdFieldName: opts.externalField,
                        contentType: 'JSON'
                    })
                    ).yields(null, jobInfo);

                sandbox.stub(bulkApi, 'createBatch')
                    .withArgs(sinon.match({
                        jobId: jobInfo.id,
                        data
                    }))
                    .yields(null, batchInfo);

                sandbox.stub(bulkApi, 'closeJob')
                    .withArgs(auth, jobInfo.id)
                    .yields();

                sandbox.stub(bulkApi, 'completeBatch')
                    .withArgs(sinon.match(jobBatchInfo))
                    .yields(null, batchInfo);

                sandbox.stub(bulkApi, 'getBatchResult')
                    .withArgs(sinon.match(jobBatchInfo))
                    .yields(null, expectedResult);

                sandbox.stub(batchSplitter, 'split').yields(null, [data]);

                sandbox.stub(batchJoiner, 'joinInputResults').returns(expectedResult);
            });

            it('should load JSON data', (done) => {
                // when
                bulk.load(opts, data, (err, result) => {
                    expect(result).to.equal(expectedResult);
                    done();
                });
            });

            it('should attempt to login if auth not provided', done => {
                // given 
                delete opts.auth;
                sandbox.stub(loginApi, 'usernamePassword')
                    .withArgs({})
                    .yields(null, auth);

                // when
                bulk.load(opts, data, (err, result) => {
                    expect(result).to.equal(expectedResult);
                    done();
                });
            });

            it('should process CSV content and convert to JSON', done => {
                // given data
                var file = chance.word();

                // given mocks
                bulkApi.createJob.restore();
                bulkApi.createBatch.restore();
                batchSplitter.split.restore();

                sandbox.stub(batchSplitter, 'split')
                    .withArgs(sinon.match({
                        contentType: 'CSV'
                    }), file)
                    .yields(null, [data]);

                sandbox.stub(bulkApi, 'createJob')
                    .withArgs(sinon.match({
                        operation: opts.action,
                        object: opts.object,
                        contentType: 'JSON'
                    }))
                    .yields(null, jobInfo);

                sandbox.stub(bulkApi, 'createBatch')
                    .withArgs(sinon.match({
                        jobId: jobInfo.id,
                        data
                    }))
                    .yields(null, batchInfo);

                // when
                bulk.load(opts, file, (err, result) => {
                    expect(result).to.equal(expectedResult);
                    done();
                });
            });

            it('should save result to path', done => {
                // given data
                opts.toPath = chance.word();
                var joinedResults = {
                    success: chance.n(chance.word, 2),
                    error: chance.n(chance.word, 3)
                };
                var expectedResult = {
                    successCount: 2,
                    errorCount: 3
                };
                var successCsv = chance.word();
                var errorCsv = chance.word();

                // given mocks
                batchJoiner.joinInputResults.restore();
                sandbox.stub(batchJoiner, 'joinInputResults').returns(joinedResults);

                var csvStub = sandbox.stub();
                csvStub.withArgs(sinon.match({
                    data: joinedResults.success
                })).returns(successCsv);

                csvStub.withArgs(sinon.match({
                    data: joinedResults.error
                })).returns(errorCsv);

                var writeStub = sandbox.stub(fs, 'writeFile');
                writeStub.withArgs(sinon.match(opts.toPath), successCsv).yields();
                writeStub.withArgs(sinon.match(opts.toPath), errorCsv).yields();

                var bulk = proxyquire('../../lib/bulk-force', {
                    json2csv: csvStub
                });

                // when
                bulk.load(opts, data, (err, actualResult) => {
                    expect(actualResult).to.deep.equal(expectedResult);
                    sinon.assert.calledTwice(writeStub);
                    done();
                })
            });

            it('should not save no results to path', done => {
                // given data
                opts.toPath = chance.word();
                var joinedResults = {
                    success: chance.n(chance.word, 2),
                    error: []
                };
                var expectedResult = {
                    successCount: 2,
                    errorCount: 0
                };
                var successCsv = chance.word();
                var errorCsv = chance.word();

                // given mocks
                batchJoiner.joinInputResults.restore();
                sandbox.stub(batchJoiner, 'joinInputResults').returns(joinedResults);

                var csvStub = sandbox.stub();
                csvStub.withArgs(sinon.match({
                    data: joinedResults.success
                })).returns(successCsv);

                var writeStub = sandbox.stub(fs, 'writeFile');
                writeStub.withArgs(sinon.match(opts.toPath), successCsv).yields();

                var bulk = proxyquire('../../lib/bulk-force', {
                    json2csv: csvStub
                });

                // when
                bulk.load(opts, data, (err, actualResult) => {
                    expect(actualResult).to.deep.equal(expectedResult);
                    sinon.assert.calledOnce(writeStub);
                    done();
                })
            });         

            it('should map data from file before creating batch', done => {
                // given data
                var mappedData = chance.word();
                opts.mapFile = chance.word();

                // given mocks
                sandbox.stub(dataMapper, 'map').returns(mappedData);

                bulkApi.createBatch.restore();
                sandbox.stub(bulkApi, 'createBatch')
                    .withArgs(sinon.match({
                        jobId: jobInfo.id,
                        data: mappedData
                    }))
                    .yields(null, batchInfo);                

                // when
                bulk.load(opts, data, (err, result) => {
                    expect(result).to.equal(expectedResult);
                    done();
                });
            });            
        });

        context('single job, multiple batches', () => {
            it('should break up data into multiple batches if exceeds batch size', done => {
                // given data
                var oneData = chance.date();
                var twoData = chance.date();
                var data = [oneData, twoData];
                var jobInfo = { id: chance.word() };
                var batchOneInfo = {
                    id: chance.word()
                };
                var batchTwoInfo = {
                    id: chance.word()
                };
                var batchOneResult = chance.date();
                var batchTwoResult = chance.date();
                var expectedResult = chance.date();

                opts.maxBatchSize = 1;

                // given mocks
                var createBatchStub = sandbox.stub(bulkApi, 'createBatch');
                var completeBatchStub = sandbox.stub(bulkApi, 'completeBatch');
                var getBatchResultStub = sandbox.stub(bulkApi, 'getBatchResult');

                sandbox.stub(bulkApi, 'createJob').yields(null, jobInfo);
                sandbox.stub(bulkApi, 'closeJob').withArgs(auth, jobInfo.id).yields();

                sandbox.stub(batchSplitter, 'split')
                    .withArgs({
                        contentType: 'JSON',
                        maxBatchSize: opts.maxBatchSize
                    }, data)
                    .yields(null, [
                        [oneData],
                        [twoData]
                    ]);

                createBatchStub
                    .withArgs(sinon.match({
                        data: [oneData]
                    })).yields(null, batchOneInfo);

                completeBatchStub
                    .withArgs(sinon.match({
                        batchId: batchOneInfo.id
                    }))
                    .yields(null, batchOneInfo);

                getBatchResultStub
                    .withArgs(sinon.match({
                        batchId: batchOneInfo.id
                    }))
                    .yields(null, batchOneResult);

                createBatchStub
                    .withArgs(sinon.match({
                        data: [twoData]
                    })).yields(null, batchTwoInfo);

                completeBatchStub
                    .withArgs(sinon.match({
                        batchId: batchTwoInfo.id
                    }))
                    .yields(null, batchTwoInfo);

                getBatchResultStub
                    .withArgs(sinon.match({
                        batchId: batchTwoInfo.id
                    }))
                    .yields(null, batchTwoResult);

                sandbox.stub(batchJoiner, 'joinInputResults')
                    .withArgs([batchOneResult, batchTwoResult])
                    .returns(expectedResult);

                // when
                bulk.load(opts, data, (err, result) => {
                    expect(result).to.equal(expectedResult);
                    done();
                });
            });
        });

        it('should group data one level prior to splitting into batches');
        it('should group data with multiple levels prior to splitting into batches');
        it('should break into multiple jobs if grouped data exceeds batch limit');

        context('errors', () => {
            var error;
            var expectedError;

            beforeEach(() => {
                error = chance.word();
                expectedError = 'Unable to load data due to failure to ';
            });

            it('should fail with error message when fails to split batches', done => {
                // given data
                expectedError += `split job into multiple batches: ${error}`;

                // given mocks
                sandbox.stub(batchSplitter, 'split').yields(error);

                // when
                bulk.load(opts, chance.word(), err => {
                    expect(err).to.equal(expectedError);
                    done();
                });
            });

            it('should fail with error message when fails to create job', done => {
                // given data
                expectedError += `create job: ${error}`;

                // given mocks
                sandbox.stub(batchSplitter, 'split').yields(null, []);
                sandbox.stub(bulkApi, 'createJob').yields(error);

                // when
                bulk.load(opts, chance.word(), err => {
                    expect(err).to.equal(expectedError);
                    done();
                });
            });

            it('should fail with error message when fails to create batch', done => {
                // given data
                expectedError += `process batch: ${error}`;

                // given mocks
                sandbox.stub(batchSplitter, 'split').yields(null, chance.n(chance.date, 2));
                sandbox.stub(bulkApi, 'createJob').yields(null, chance.jobInfo());
                sandbox.stub(bulkApi, 'closeJob').yields();
                sandbox.stub(bulkApi, 'createBatch').yields(error);

                // when
                bulk.load(opts, chance.word(), err => {
                    expect(err).to.equal(expectedError);
                    done();
                });
            });

            it('should fail with error message when fails to complete batch', done => {
                // given data
                expectedError += `process batch: ${error}`;

                // given mocks
                sandbox.stub(batchSplitter, 'split').yields(null, chance.n(chance.date, 2));
                sandbox.stub(bulkApi, 'createJob').yields(null, chance.jobInfo());
                sandbox.stub(bulkApi, 'createBatch').yields(null, chance.batchInfo());
                sandbox.stub(bulkApi, 'closeJob').yields();
                sandbox.stub(bulkApi, 'completeBatch').yields(error);

                // when
                bulk.load(opts, chance.word(), err => {
                    expect(err).to.equal(expectedError);
                    done();
                });
            });

            it('should fail with error message when fails to get batch result', done => {
                // given data
                expectedError += `process batch: ${error}`;

                // given mocks
                sandbox.stub(batchSplitter, 'split').yields(null, chance.n(chance.date, 2));
                sandbox.stub(bulkApi, 'createJob').yields(null, chance.jobInfo());
                sandbox.stub(bulkApi, 'createBatch').yields(null, chance.batchInfo());
                sandbox.stub(bulkApi, 'completeBatch').yields(null, chance.batchInfo());
                sandbox.stub(bulkApi, 'closeJob').yields();
                sandbox.stub(bulkApi, 'getBatchResult').yields(error);

                // when
                bulk.load(opts, chance.word(), err => {
                    expect(err).to.equal(expectedError);
                    done();
                });
            });

            it('should fail with error message when fails to close job', done => {
                // given data
                expectedError = `Unable to close job: ${error}`;

                // given mocks
                sandbox.stub(batchSplitter, 'split').yields(null, chance.n(chance.date, 2));
                sandbox.stub(bulkApi, 'createJob').yields(null, chance.jobInfo());
                sandbox.stub(bulkApi, 'createBatch').yields(null, chance.batchInfo());
                sandbox.stub(bulkApi, 'completeBatch').yields(null, chance.batchInfo());
                sandbox.stub(bulkApi, 'getBatchResult').yields(null, chance.word());
                sandbox.stub(bulkApi, 'closeJob').yields(error);

                // when
                bulk.load(opts, chance.word(), err => {
                    expect(err).to.equal(expectedError);
                    done();
                });
            });

            it('should fail with error message even when closing job also fails', done => {
                // given data
                var batchError = chance.word();
                var closeJobError = chance.word();
                expectedError += `process batch: ${batchError}; Unable to close job: ${closeJobError}`;

                // given mocks
                sandbox.stub(batchSplitter, 'split').yields(null, chance.n(chance.date, 2));
                sandbox.stub(bulkApi, 'createJob').yields(null, chance.jobInfo());
                sandbox.stub(bulkApi, 'createBatch').yields(batchError);
                sandbox.stub(bulkApi, 'closeJob').yields(closeJobError);

                // when
                bulk.load(opts, chance.word(), err => {
                    expect(err).to.equal(expectedError);
                    done();
                });
            });

            it('should fail with error message when unable to save success result to path', done => {
                // given data
                opts.toPath = chance.word();

                var data = chance.n(chance.word, 2);
                var joinedResults = {
                    success: chance.n(chance.word, 2),
                    error: chance.n(chance.word, 3)
                };
                var expectedResult = {
                    successCount: 2,
                    errorCount: 3
                };
                var successCsv = chance.word();
                var errorCsv = chance.word();
                var expectedError = `Unable to save success file: ${error}`;

                // given mocks
                sandbox.stub(batchSplitter, 'split').yields(null, chance.n(chance.date, 2));
                sandbox.stub(bulkApi, 'createJob').yields(null, chance.jobInfo());
                sandbox.stub(bulkApi, 'createBatch').yields(null, chance.batchInfo());
                sandbox.stub(bulkApi, 'completeBatch').yields(null, chance.batchInfo());
                sandbox.stub(bulkApi, 'getBatchResult').yields(null, chance.word());                
                sandbox.stub(bulkApi, 'closeJob').yields();                
                sandbox.stub(batchJoiner, 'joinInputResults').returns(joinedResults);

                var csvStub = sandbox.stub();
                csvStub.withArgs(sinon.match({
                    data: joinedResults.success
                })).returns(successCsv);

                csvStub.withArgs(sinon.match({
                    data: joinedResults.error
                })).returns(errorCsv);

                var writeStub = sandbox.stub(fs, 'writeFile');
                writeStub.withArgs(sinon.match(opts.toPath), successCsv).yields(error);
                writeStub.withArgs(sinon.match(opts.toPath), errorCsv).yields();

                var bulk = proxyquire('../../lib/bulk-force', {
                    json2csv: csvStub
                });

                // when
                bulk.load(opts, data, err => {
                    expect(err).to.equal(expectedError);
                    done();
                })
            });     

            it('should fail with error message when unable to save success result to path', done => {
                // given data
                opts.toPath = chance.word();

                var data = chance.n(chance.word, 2);
                var joinedResults = {
                    success: chance.n(chance.word, 2),
                    error: chance.n(chance.word, 3)
                };
                var expectedResult = {
                    successCount: 2,
                    errorCount: 3
                };
                var successCsv = chance.word();
                var errorCsv = chance.word();
                var expectedError = `Unable to save error file: ${error}`;

                // given mocks
                sandbox.stub(batchSplitter, 'split').yields(null, chance.n(chance.date, 2));
                sandbox.stub(bulkApi, 'createJob').yields(null, chance.jobInfo());
                sandbox.stub(bulkApi, 'createBatch').yields(null, chance.batchInfo());
                sandbox.stub(bulkApi, 'completeBatch').yields(null, chance.batchInfo());
                sandbox.stub(bulkApi, 'getBatchResult').yields(null, chance.word());                
                sandbox.stub(bulkApi, 'closeJob').yields();                
                sandbox.stub(batchJoiner, 'joinInputResults').returns(joinedResults);

                var csvStub = sandbox.stub();
                csvStub.withArgs(sinon.match({
                    data: joinedResults.success
                })).returns(successCsv);

                csvStub.withArgs(sinon.match({
                    data: joinedResults.error
                })).returns(errorCsv);

                var writeStub = sandbox.stub(fs, 'writeFile');
                writeStub.withArgs(sinon.match(opts.toPath), successCsv).yields();
                writeStub.withArgs(sinon.match(opts.toPath), errorCsv).yields(error);

                var bulk = proxyquire('../../lib/bulk-force', {
                    json2csv: csvStub
                });

                // when
                bulk.load(opts, data, err => {
                    expect(err).to.equal(expectedError);
                    done();
                })
            });         

            it('should fail with error message when unable to parse mapping file', done => {
                // given data
                var expectedError = `Unable to load data due to failure to process batch: Unable to load data due to failure to process mapping file: ${error}`;
                opts.mapFile = chance.word();                

                // given mocks
                sandbox.stub(batchSplitter, 'split').yields(null, chance.n(chance.date, 2));
                sandbox.stub(bulkApi, 'createJob').yields(null, chance.jobInfo());                
                sandbox.stub(dataMapper, 'map').throws(error);
                sandbox.stub(bulkApi, 'closeJob').yields();                

                // when
                bulk.load(opts, chance.word(), err => {
                    expect(err).to.equal(expectedError);
                    done();
                });
            });                
        });
    });

    describe('#query(opts, soql, cb)', () => {
        var jobInfo;
        var batchInfo;
        var soql;

        beforeEach(() => {
            jobInfo = chance.jobInfo();
            batchInfo = chance.batchInfo();
            soql = chance.word();
        });

        it('should create batch query and return results', done => {
            // given data
            var object = chance.word();
            var auth = chance.date();
            var expectedResult = chance.n(chance.date, 2);
            var opts = { auth, object };

            // given mocks
            sandbox.stub(bulkApi, 'createJob')
                .withArgs(sinon.match({
                    operation: 'query',
                    object,
                    contentType: 'CSV'
                }))
                .yields(null, jobInfo);

            sandbox.stub(bulkApi, 'createBatch')
                .withArgs(sinon.match({
                    query: soql
                }))
                .yields(null, batchInfo);

            sandbox.stub(bulkApi, 'closeJob').yields(null, jobInfo);
            sandbox.stub(bulkApi, 'completeBatch').yields(null, batchInfo);
            sandbox.stub(bulkApi, 'getBatchResult').yields(null, expectedResult);

            // when
            bulk.query(opts, soql, (err, actualResult) => {
                expect(actualResult).to.equal(expectedResult);
                done();
            });
        });

        it('should save batch query result to file', done => {
            // given data
            var toFile = chance.word();
            var data = chance.n(chance.date, 2);
            var csv = chance.string();
            var expectedResult = { recordCount: data.length };

            opts.toFile = toFile;

            // given mocks
            sandbox.stub(bulkApi, 'createJob').yields(null, jobInfo);
            sandbox.stub(bulkApi, 'createBatch').yields(null, batchInfo);
            sandbox.stub(bulkApi, 'completeBatch').yields(null, batchInfo);
            sandbox.stub(bulkApi, 'closeJob').yields(null, jobInfo);
            sandbox.stub(bulkApi, 'getBatchResult').yields(null, data);

            var csvStub = sandbox.stub();
            csvStub.withArgs(sinon.match({
                data
            })).returns(csv);

            sandbox.stub(fs, 'writeFile').withArgs(toFile, csv).yields();

            var bulk = proxyquire('../../lib/bulk-force', {
                json2csv: csvStub
            });

            // when
            bulk.query(opts, soql, (err, actualResult) => {
                expect(actualResult).to.deep.equal(expectedResult);
                done();
            });
        });

        it('should attempt to login if auth not provided', done => {
            // given data
            delete opts.auth;
            var expectedResult = chance.date();

            // given mocks
            sandbox.stub(loginApi, 'usernamePassword')
                .withArgs({})
                .yields(null, auth);

            sandbox.stub(bulkApi, 'createJob')
                .withArgs(sinon.match({
                    auth
                }))
                .yields(null, jobInfo);

            sandbox.stub(bulkApi, 'createBatch').yields(null, batchInfo);
            sandbox.stub(bulkApi, 'closeJob').yields(null, jobInfo);
            sandbox.stub(bulkApi, 'completeBatch').yields(null, batchInfo);
            sandbox.stub(bulkApi, 'getBatchResult').yields(null, expectedResult);

            // when
            bulk.query(opts, soql, (err, result) => {
                expect(result).to.equal(expectedResult);
                done();
            });
        });

        context('errors', () => {
            var errror;

            beforeEach(() => {
                error = chance.word();
            });

            it('should fail with error message when fails to create job', done => {
                // given data
                var expectedError = `Unable to query data due to failure to create job: ${error}`;

                // given mocks
                sandbox.stub(bulkApi, 'createJob').yields(error);

                // when
                bulk.query(opts, soql, err => {
                    expect(err).to.equal(expectedError);
                    done();
                });
            });

            it('should fail with error message when fails to create batch', done => {
                // given data
                var expectedError = `Unable to query data due to failure to process batch: ${error}`;

                // given mocks
                sandbox.stub(bulkApi, 'createJob').yields(null, jobInfo);
                sandbox.stub(bulkApi, 'createBatch').yields(error);
                sandbox.stub(bulkApi, 'closeJob').yields();

                // when
                bulk.query(opts, soql, err => {
                    expect(err).to.equal(expectedError);
                    done();
                });
            });

            it('should fail with error message when fails to complete batch', done => {
                // given data
                var expectedError = `Unable to query data due to failure to process batch: ${error}`;

                // given mocks
                sandbox.stub(bulkApi, 'createJob').yields(null, jobInfo);
                sandbox.stub(bulkApi, 'createBatch').yields(null, batchInfo);
                sandbox.stub(bulkApi, 'completeBatch').yields(error);
                sandbox.stub(bulkApi, 'closeJob').yields();

                // when
                bulk.query(opts, soql, err => {
                    expect(err).to.equal(expectedError);
                    done();
                });
            });

            it('should fail with error message when fails to get batch result', done => {
                // given data
                var expectedError = `Unable to query data due to failure to process batch: ${error}`;

                // given mocks
                sandbox.stub(bulkApi, 'createJob').yields(null, jobInfo);
                sandbox.stub(bulkApi, 'createBatch').yields(null, batchInfo);
                sandbox.stub(bulkApi, 'completeBatch').yields(null, batchInfo);
                sandbox.stub(bulkApi, 'getBatchResult').yields(error);
                sandbox.stub(bulkApi, 'closeJob').yields();

                // when
                bulk.query(opts, soql, err => {
                    expect(err).to.equal(expectedError);
                    done();
                });
            });

            it('should fail with error message when fails to get close job', done => {
                // given data
                var expectedError = `Unable to close job: ${error}`;
                var expectedResult = chance.word();

                // given mocks
                sandbox.stub(bulkApi, 'createJob').yields(null, jobInfo);
                sandbox.stub(bulkApi, 'createBatch').yields(null, batchInfo);
                sandbox.stub(bulkApi, 'completeBatch').yields(null, batchInfo);
                sandbox.stub(bulkApi, 'getBatchResult').yields(null, expectedResult);
                sandbox.stub(bulkApi, 'closeJob').yields(error);

                // when
                bulk.query(opts, soql, (err, result) => {
                    expect(err).to.equal(expectedError);
                    expect(result).to.equal(expectedResult);
                    done();
                });
            });

            it('should fail with error message even when closing job also fails', done => {
                // given data
                var createBatchError = chance.word();
                var closeJobError = chance.word();
                var expectedError = `Unable to query data due to failure to process batch: ${createBatchError}; Unable to close job: ${closeJobError}`;

                // given mocks
                sandbox.stub(bulkApi, 'createJob').yields(null, jobInfo);
                sandbox.stub(bulkApi, 'createBatch').yields(createBatchError);
                sandbox.stub(bulkApi, 'closeJob').yields(closeJobError);

                // when
                bulk.query(opts, soql, err => {
                    expect(err).to.equal(expectedError);
                    done();
                });
            });
        });
    });
});