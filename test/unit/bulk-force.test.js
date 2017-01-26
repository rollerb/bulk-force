const bulk = require('../../lib/bulk-force');
const expect = require('chai').expect;
const chance = require('chance').Chance();
const sinon = require('sinon');
const bulkApi = require('../../lib/salesforce-bulk-api');

describe('bulk force', () => {
    const sandbox = sinon.sandbox.create();

    afterEach(() => {
        sandbox.restore();
    });

    it('#loadData(opts, data, cb)', (done) => {
        // given data
        var auth = {
            instanceUrl: chance.word(),
            accessToken: chance.word()
        };
        var opts = {
            action: chance.word(),
            object: chance.word(),
            auth
        };
        var jobInfo = {
            id: chance.word()
        };
        var batchInfo = {
            id: chance.word()
        };
        var jobBatchInfo = {
            jobId: jobInfo.id,
            batchId: batchInfo.id
        };
        var data = chance.n(chance.word, 10);
        var expectedResult = chance.n(chance.word, 10);
        
        // given mocks
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

        // when
        bulk.loadData(opts, data, (err, result) => {
            expect(result).to.equal(expectedResult);
            done();
        });
    });

    it('should login from environment if auth not provided');
    it('should detect JSON if data is an object');
    it('should detect CSV if data is a file location');
    it('should break up data into multiple batches if exceeds batch size');
    it('should group data one level prior to splitting into batches');
    it('should group data with multiple levels prior to splitting into batches');
    it('should break into multiple jobs if grouped data exceeds batch limit');
});