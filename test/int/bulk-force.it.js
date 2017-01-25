const bulk = require('../../lib/bulk-force');
const chance = require('chance').Chance();
const expect = require('chai').expect;

describe.only('bulk-force', () => {
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

        bulk.loadData({
            action: 'insert',
            object: 'Account'
        }, data, (err, results) => {
            expect(err).to.not.exist;
            expect(results).to.have.lengthOf(2);
            done();
        });
    });
});