const chai = require('chai');
const expect = chai.expect;
const chance = require('chance').Chance();
const joiner = require('../../lib/bulk-batch-result-joiner');

describe('bulk-batch-result-joiner', () => {

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
        var actualResults = joiner.join(results);

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
        var actualResults = joiner.join([result]);

        // then
        expect(actualResults).to.deep.equal(expectedResults);
    });
});