const bulk = require('../../lib/bulk-force');
const chance = require('chance').Chance();
const expect = require('chai').expect;
const restApi = require('../../lib/salesforce-rest-api');

describe.only('bulk-force', () => {
    chance.mixin({
        'account': () => {
            return {
                Name: chance.word(),
                Site: chance.word()
            };
        }
    });

    it('load data from JSON', (done) => {
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

    it.skip('load data using mapping file', done => {
        var mapFile = `${process.cwd()}/test/int/data/map.properties`
        var account = {
            customFieldName: chance.word(),
            Site: chance.word()
        };
        var opts = {
            object: 'Account',
            action: 'insert',
            mapping: mapFile
        };

        bulk.load(opts, [account], (err, result) => {
            expect(err).to.not.exist;
            expect(result.success).to.have.lengthOf(1);
            expect(result.error).to.have.lengthOf(0);
        });
    });

    it.only('load data and save results to disk', done => {
        var opts = {
            action: 'insert',
            object: 'Account',
            toPath: `${process.cwd()}/test/int/data`
        }
        var data = chance.n(chance.account, 2);

        bulk.load(opts, data, (err, result) => {
            expect(err).to.not.exist;
            expect(result.successCount).to.equal(2);
            expect(result.errorCount).to.equal(0);
            done();
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

    it('extract data by SOQL to file', done => {
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

    context('delete data', () => {
        it.skip('delete data conditionally', done => {
            createAccount(accountId => {
                var soql = `Select Id from Account where Id=${accountId}`;

                bulk.delete(opts, soql, (err, result) => {
                    expect(err).to.not.exist;
                    expect(result.ids.length).to.equal(1);
                    expect(result.ids[0]).to.equal(accountId);
                    done();
                });
            });
        });

        function createAccount(cb) {
            var opts = {
                object: 'Account',
                action: 'insert'
            };

            bulk.load(opts, [chance.account()], (err, result) => {
                expect(err).to.not.exist;
                cb(result.success[0].id);
            });
        }
    });
});