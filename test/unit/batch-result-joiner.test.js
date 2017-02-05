const chai = require('chai');
const expect = chai.expect;
const chance = require('chance').Chance();
const joiner = require('../../lib/bulk-batch-result-joiner');

describe('bulk-batch-result-joiner', () => {

    describe('#join(results)', () => {
        it('should join two results into one', () => {
            // given
            var oneResult = {
                success: chance.n(chance.word, 5),
                error: chance.n(chance.word, 5)
            };
            var twoResult = {
                success: chance.n(chance.word, 5),
                error: chance.n(chance.word, 5)
            };
            var results = [oneResult, twoResult];
            var expectedResults = {
                success: oneResult.success.concat(twoResult.success),
                error: oneResult.error.concat(twoResult.error)
            };

            // when
            var actualResults = joiner.joinInputResults(results);

            // then
            expect(actualResults).to.deep.equal(expectedResults);
        });

        it('should return one result if no more to join', () => {
            // given
            var result = {
                success: chance.n(chance.word, 5),
                error: chance.n(chance.word, 5)
            };
            var expectedResults = {
                success: result.success,
                error: result.error
            };

            // when
            var actualResults = joiner.joinInputResults([result]);

            // then
            expect(actualResults).to.deep.equal(expectedResults);
        });
    });

    describe('#joinQueryResults(results)', () => {
        it('should join two query results into one with lowercase id', () => {
            // given
            var resultOne = [{Id: chance.word(), Name: chance.word()}];
            var resultTwo = [{Id: chance.word(), Name: chance.word()}];
            var results = [resultOne, resultTwo];
            var expectedResult = [
                {id: resultOne[0].Id, Name: resultOne[0].Name},
                {id: resultTwo[0].Id, Name: resultTwo[0].Name},
            ];

            // when
            var actualResult = joiner.joinQueryResults(results);

            // then
            expect(actualResult).to.deep.equal(expectedResult);
        });

        it('should join one query result if no more to join', () => {
            // given
            var result = [{Id: chance.word(), Name: chance.word()}];
            var results = [result];
            var expectedResult = [
                {id: result[0].Id, Name: result[0].Name}
            ];

            // when
            var actualResult = joiner.joinQueryResults(results);

            // then
            expect(actualResult).to.deep.equal(expectedResult);
        });
    });
});