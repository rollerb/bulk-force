/*
  var resultRequest = [
      {
          Name: chance.word()
      }, {
          Name: chance.word()
      }
  ];

  var resultResponse = [
      {
          succcess: true,
          id: chance.word()
      },
      {
          success: false,
          id: null,
          errors: [{
              message: chance.word(),
              statusCode: chance.word()
          }]
      }
  ];

  var expectedResult = {
      success: [{
          id: resultResponse[0].id,
          Name: resultRequest[0].Name
      }],
      error: [{
          error: resultResponse[1].errors[0].statusCode + resultResponse[1].errors[0].message,
          Name: resultRequest[1].Name
      }]
  };
  */
const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');
const sinonChai = require('sinon-chai')
const request = require('request');
const chance = require('chance').Chance();
const resultBuilder = require('../../lib/bulk-result-builder');

chai.use(sinonChai);

describe('bulk-result-builder', () => {
    const sandbox = sinon.sandbox.create();

    afterEach(() => {
        sandbox.restore();
    });

    it('parse json', done => {
        // given
        var bulkRequest = [{ name: chance.word() }];
        var bulkResponse = [{
            success: true,
            id: chance.word()
        }];
        var expectedResult = {
            success: [{ id: bulkResponse[0].id, name: bulkRequest[0].name }],
            error: []
        };

        // when
        var result = resultBuilder.build(bulkRequest, bulkResponse, (err, result) => {
            expect(result).to.deep.equal(expectedResult);
            done();
        });
    });

    it('parse csv', done => {
        var requestName = chance.word();
        var bulkRequest = `"name"
            "${requestName}"`;
        var responseId = chance.word();
        var bulkResponse = `"Id","Success"
            "${responseId}","true"`;
        var expectedResult = {
            success: [{ id: responseId, name: requestName }],
            error: []
        };

        // when
        var result = resultBuilder.build(bulkRequest, bulkResponse, (err, result) => {
            expect(result).to.deep.equal(expectedResult);
            done();
        });
    });

    it('parse json error', done => {
        // given
        var bulkRequest = [{ name: chance.word() }];
        var message = chance.word();
        var statusCode = chance.word();
        var bulkResponse = [{
            success: false,
            id: null,
            errors: [{
                message,
                statusCode
            }]
        }];
        var expectedResult = {
            success: [],
            error: [{ name: bulkRequest[0].name, error: `${statusCode}: ${message}` }]
        };

        // when
        var result = resultBuilder.build(bulkRequest, bulkResponse, (err, result) => {
            expect(result).to.deep.equal(expectedResult);
            done();
        });
    });

    it('parse csv error', done => {
        // given
        var bulkRequest = [{ name: chance.word() }];
        var requestName = chance.word();
        var bulkRequest = `"name"
            "${requestName}"`;
        var errorMessage = chance.word();
        var bulkResponse = `"Id","Success","Error"
            "","false","${errorMessage}"`;
        var expectedResult = {
            success: [],
            error: [{ name: requestName, error: errorMessage }]
        };

        // when
        var result = resultBuilder.build(bulkRequest, bulkResponse, (err, result) => {
            expect(result).to.deep.equal(expectedResult);
            done();
        });
    });
});