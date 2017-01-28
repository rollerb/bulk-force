const bulk = require('../../lib/bulk-force');
const chance = require('chance').Chance();
const expect = require('chai').expect;
const loginApi = require('../../lib/salesforce-login-api');
const restApi = require('../../lib/salesforce-rest-api');

describe('bulk-force', () => {
    it('#loadData(opts, data, cb) with JSON', (done) => {
        chance.mixin({
            'account': () => {
                return {
                    Name: chance.word(),
                    Site: chance.word()
                };
            }
        });
        var data = chance.n(chance.account, 2);

        loginApi.usernamePassword({}, (err, auth) => {
            var opts = {
                auth,
                action: 'insert',
                object: 'Account'
            };

            bulk.loadData(opts, data, (err, results) => {
                expect(err).to.not.exist;
                expect(results.success).to.have.lengthOf(2);

                restApi.deleteRecords(opts, results.success, err => {
                    expect(err).to.not.exist;
                    done();
                });
            });
        });
    });
});