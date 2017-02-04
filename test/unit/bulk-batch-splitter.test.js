const chai = require('chai');
const expect = chai.expect;
const chance = require('chance').Chance();
const sinon = require('sinon');
const proxyquire = require('proxyquire');
var batchSplitter = require('../../lib/bulk-batch-splitter');

describe('bulk-batch-splitter', () => {
    var sandbox = sinon.sandbox.create();
    var data;
    var expectedSplit;

    beforeEach(() => {
        data = chance.n(chance.date, 2);
        expectedSplit = [
            [data[0]],
            [data[1]]
        ];
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('should split data', done => {
        // given
        var opts = {
            maxBatchSize: 1
        };

        // when
        batchSplitter.split(opts, data, (err, splitData) => {
            expect(splitData).to.deep.equal(expectedSplit);
            done();
        });
    });

    it('should default max batch size if none provided', done => {
        // given
        expectedSplit = [[data[0], data[1]]];
        var opts = {};

        // when
        batchSplitter.split(opts, data, (err, splitData) => {
            expect(splitData).to.deep.equal(expectedSplit);
            done();
        });
    });

    context('from CSV', () => {
        var readStub;
        var opts;
        var file;

        beforeEach(() => {
            opts = {
                maxBatchSize: 1,
                contentType: 'CSV'
            };
            file = chance.word();
            readStub = sandbox.stub();

            batchSplitter = proxyquire('../../lib/bulk-batch-splitter', {
                csvtojson: () => {
                    return {
                        fromFile: readStub
                    };
                }
            });
        });

        it('should load CSV and then split data', done => {
            // given mocks
            readStub.yields(null, data);

            // when
            batchSplitter.split(opts, file, (err, splitData) => {
                expect(splitData).to.deep.equal(expectedSplit);
                done();
            })
        });

        it('should fail with CSV error message', done => {
            // given
            var error = chance.word();
            var expectedError = `Unable to split data into batches due to error: ${error}`;

            // given mocks            
            readStub.yields(error);

            // when
            batchSplitter.split(opts, file, err => {
                expect(err).to.deep.equal(expectedError);
                done();
            })
        });
    });
});