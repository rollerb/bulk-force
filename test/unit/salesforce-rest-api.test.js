const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');
const sinonChai = require('sinon-chai')
const request = require('request');
const chance = require('chance').Chance();
const salesforceRest = require('../../lib/salesforce-rest-api');

chai.should();
chai.use(sinonChai);

describe('salesforce-rest-api:unit', () => {
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

    describe('#deleteRecords(opts, cb)', () => {
        const SUCCESS_CODE = 204;

        it('should delete all records', (done) => {
            // given data
            opts.object = chance.string();
            var records = [
                { id: chance.string() },
                { id: chance.string() }
            ];

            // given mocks
            var deleteStub = sandbox.stub(request, 'delete')
                .withArgs(sinon.match(opts.object))
                .yields(null, {
                    statusCode: SUCCESS_CODE
                });

            // when
            salesforceRest.deleteRecords(opts, records, err => {
                expect(err).to.not.exist;
                deleteStub.should.have.been.calledTwice;
                done();
            });
        });

        it('should find id or Id', (done) => {
            // given data
            opts.object = chance.string();
            var records = [
                { id: chance.string() },
                { Id: chance.string() }
            ];

            // given mocks
            var deleteStub = sandbox.stub(request, 'delete')
                .withArgs(sinon.match(opts.object))
                .yields(null, {
                    statusCode: SUCCESS_CODE
                });

            // when
            salesforceRest.deleteRecords(opts, records, err => {
                expect(err).to.not.exist;
                deleteStub.should.have.been.calledWith(sinon.match(records[0].id));
                deleteStub.should.have.been.calledWith(sinon.match(records[1].Id));
                done();
            });
        });

        it('should fail with message when non-204 response code', (done) => {
            // given data
            opts.object = chance.string();
            var records = [
                { id: chance.string() }
            ];
            var expectedException = [
                {
                    message: chance.string(),
                    errorCode: chance.string()
                }
            ];

            // given mocks
            var deleteStub = sandbox.stub(request, 'delete')
                .withArgs(sinon.match(opts.object))
                .yields(null, {
                    statusCode: 500
                }, expectedException);

            // when
            salesforceRest.deleteRecords(opts, records, err => {
                err.should.equal(`Failed to delete record ${records[0].id} from ${opts.object}. Error received: ${expectedException[0].errorCode}; ${expectedException[0].message}`);
                done();
            });
        });

        it('should fail with message when unexecpted request error', (done) => {
            // given data
            opts.object = chance.string();
            var records = [
                { id: chance.string() }
            ];
            var expectedException = chance.string();

            // given mocks
            var deleteStub = sandbox.stub(request, 'delete')
                .withArgs(sinon.match(opts.object))
                .yields(expectedException);

            // when
            salesforceRest.deleteRecords(opts, records, err => {
                err.should.equal(`Failed to delete record ${records[0].id} from ${opts.object} due to unexpected error: ${expectedException}`);
                done();
            });
        });
    });
});