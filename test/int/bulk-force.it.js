const bulk = require('../../lib/bulk-force');
const chance = require('chance').Chance();
const expect = require('chai').expect;
const restApi = require('../../lib/salesforce-rest-api');

describe.only('bulk-force', () => {
    it('load data from JSON', (done) => {
        chance.mixin({
            'account': () => {
                return {
                    Name: chance.word(),
                    Site: chance.word()
                };
            }
        });
        var data = chance.n(chance.account, 2);

        var opts = {
            action: 'insert',
            object: 'Account'
        };

        bulk.load(opts, data, (err, result) => {
            expect(err).to.not.exist;
            expect(result.success).to.have.lengthOf(2);
            expect(result.error).to.have.lengthOf(0);

            restApi.deleteRecords(opts, result.success, err => {
                expect(err).to.not.exist;
                done();
            });
        });
    });

    it('load data from a CSV file', done => {
        var file = `${process.cwd()}/test/int/data/test.csv`;

        var opts = {
            action: 'insert',
            object: 'Account'
        };

        bulk.load(opts, file, (err, result) => {
            expect(err).to.not.exist;
            expect(result.success).to.have.lengthOf(2);
            expect(result.error).to.have.lengthOf(0);

            restApi.deleteRecords(opts, result.success, err => {
                expect(err).to.not.exist;
                done();
            });
        });        
    });

    it('extract data by SOQL', done => {
        var opts = {
            object: 'Account'
        };
        var soql = 'Select Id, Name from Account';

        bulk.query(opts, soql, (err, result) => {
            expect(err).to.not.exist;
            expect(result.length).to.be.at.least(1);
            done();          
        });
    });

    it.only('extract data by SOQL to file', done => {
        var opts = {
            object: 'Account',
            toFile: `${process.cwd()}/test/int/data/out-test.csv`
        };
        var soql = 'Select Id, Name from Account';

        bulk.query(opts, soql, (err, result) => {
            expect(err).to.not.exist;
            expect(result.recordCount).to.be.at.least(1);
            done();          
        });
    });

    it('delete data conditionally');
    it('delete all data');
});