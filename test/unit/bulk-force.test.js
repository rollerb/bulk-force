const bulk = require('../../lib/bulk-force');
const expect = require('chai').expect;
const chance = require('chance').Chance();
const sinon = require('sinon');
const bulkApi = require('../../lib/salesforce-bulk-api');
const loginApi = require('../../lib/salesforce-login-api');

describe('bulk force#loadData(opts, data, cb)', () => {
    const sandbox = sinon.sandbox.create();

    var auth;
    var opts;
    var data;
    var expectedResult;
    var jobInfo;
    var batchInfo;

    afterEach(() => {
        sandbox.restore();
    });

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

        auth = {
            instanceUrl: chance.word(),
            accessToken: chance.word()
        };

        opts = {
            action: chance.word(),
            object: chance.word(),
            auth
        };

        expectedResult = chance.n(chance.word, 10);

        sandbox.stub(bulkApi, 'createJob')
            .withArgs(sinon.match({
                operation: opts.action,
                object: opts.object,
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

    it('should detect CSV if data is a file location', done => {
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
                file
            }))
            .yields(null, batchInfo);            

        // when
        bulk.loadData(opts, file, (err, result) => {
            expect(result).to.equal(expectedResult);
            done();
        });
    });

    it('should break up data into multiple batches if exceeds batch size');
    it('should group data one level prior to splitting into batches');
    it('should group data with multiple levels prior to splitting into batches');
    it('should break into multiple jobs if grouped data exceeds batch limit');
});