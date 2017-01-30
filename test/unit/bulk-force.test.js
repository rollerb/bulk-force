const bulk = require('../../lib/bulk-force');
const expect = require('chai').expect;
const chance = require('chance').Chance();
const sinon = require('sinon');
const bulkApi = require('../../lib/salesforce-bulk-api');
const loginApi = require('../../lib/salesforce-login-api');
const batchSplitter = require('../../lib/bulk-batch-splitter');
const batchJoiner = require('../../lib/bulk-batch-result-joiner');

describe('bulk force#loadData(opts, data, cb)', () => {
    const sandbox = sinon.sandbox.create();

    var auth;
    var opts;

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

    context('single job, single batch', () => {
        var data;
        var expectedResult;
        var jobInfo;
        var batchInfo;

        beforeEach(() => {
            jobInfo = {
                id: chance.word()
            };

            batchInfo = {
                id: chance.word()
            };

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

            sandbox.stub(batchJoiner, 'join').returns(expectedResult);                      
        });

        it('#loadData(opts, data, cb)', (done) => {
            // when
            bulk.loadData(opts, data, (err, result) => {
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
            bulk.loadData(opts, data, (err, result) => {
                expect(result).to.equal(expectedResult);
                done();
            });
        });

        it('should be CSV content type if data is a string', done => {
            // given data
            var file = chance.word();

            // given mocks
            bulkApi.createJob.restore();
            bulkApi.createBatch.restore();

            sandbox.stub(bulkApi, 'createJob')
                .withArgs(sinon.match({
                    operation: opts.action,
                    object: opts.object,
                    contentType: 'CSV'
                })
                ).yields(null, jobInfo);

            sandbox.stub(bulkApi, 'createBatch')
                .withArgs(sinon.match({
                    jobId: jobInfo.id,
                    file: data
                }))
                .yields(null, batchInfo);

            // when
            bulk.loadData(opts, file, (err, result) => {
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

            sandbox.stub(batchJoiner, 'join')
                .withArgs([batchOneResult, batchTwoResult])
                .returns(expectedResult);

            // when
            bulk.loadData(opts, data, (err, result) => {
                expect(result).to.equal(expectedResult);
                done();
            });
        });
    });

    it('should group data one level prior to splitting into batches');
    it('should group data with multiple levels prior to splitting into batches');
    it('should break into multiple jobs if grouped data exceeds batch limit');

    context('errors', () => {
        it('should fail with error message whne fails to create job');
        it('should fail with error message whne fails to create batch');
        it('should fail with error message whne fails to close job');
        it('should fail with error message whne fails to complete batch');
        it('should fail with error message whne fails to get batch result');
    });
});