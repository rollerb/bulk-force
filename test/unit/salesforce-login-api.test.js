const chai = require('chai');
const sinon = require('sinon');
const request = require('request');
const chance = require('chance').Chance();
const salesforceLogin = require('../../lib/salesforce-login-api');

chai.should();

describe('salesforce-login-api:unit', () => {
    var sandbox = sinon.sandbox.create();

    afterEach(() => {
        sandbox.restore();
    });

    describe('#usernamePassword(opts, cb)', () => {
        var opts;

        beforeEach(() => {
            opts = {
                username: chance.word(),
                password: chance.word(),
                clientId: chance.word(),
                clientSecret: chance.word(),
                securityToken: chance.word()
            };
        });

        it('should login and return access token and instance URL', (done) => {
            // given data
            var expectedAccessToken = chance.string();
            var expectedInstanceUrl = chance.string();

            // given mocks
            sandbox.stub(request, 'post').withArgs(sinon.match.string, sinon.match({
                qs: {
                    grant_type: 'password',
                    client_id: opts.clientId,
                    client_secret: opts.clientSecret,
                    username: opts.username,
                    password: opts.password + opts.securityToken
                }
            })).yields(null, {
                statusCode: 200
            }, {
                instance_url: expectedInstanceUrl,
                access_token: expectedAccessToken
            });
            
            // when
            salesforceLogin.usernamePassword(opts, (err, response) => {
                // then
                response.accessToken.should.equal(expectedAccessToken);
                response.instanceUrl.should.equal(expectedInstanceUrl);
                done();
            });
        });

        it('should login using environment variables when no credentials provided', (done) => {
            // given data
            var expectedAccessToken = chance.string();
            var expectedInstanceUrl = chance.string();

            process.env.SF_CLIENT_ID = opts.clientId;
            process.env.SF_CLIENT_SECRET = opts.clientSecret;
            process.env.SF_USERNAME = opts.username;
            process.env.SF_PASSWORD = opts.password;
            process.env.SF_SECURITY_TOKEN = opts.securityToken;

            // given mocks
            sandbox.stub(request, 'post').withArgs(sinon.match.string, sinon.match({
                qs: {
                    grant_type: 'password',
                    client_id: opts.clientId,
                    client_secret: opts.clientSecret,
                    username: opts.username,
                    password: opts.password + opts.securityToken
                }
            })).yields(null, {
                statusCode: 200
            }, {
                instance_url: expectedInstanceUrl,
                access_token: expectedAccessToken
            });
            
            // when
            salesforceLogin.usernamePassword({}, (err, response) => {
                // then
                response.accessToken.should.equal(expectedAccessToken);
                response.instanceUrl.should.equal(expectedInstanceUrl);
                done();
            });
        });

        context('exceptions', () => {
            it('should fail with error message when non-200 response code', (done) => {
                // given mocks
                sandbox.stub(request, 'post').yields(null, {
                    statusCode: 500
                }, 'server error');

                // when
                salesforceLogin.usernamePassword(opts, err => {
                    err.should.equal('Failed to login due to error received from Salesforce. Please check your credentials provided.');
                    done();
                });
            });

            it('should fail with error message when unexpected request error', (done) => {
                // given mocks
                sandbox.stub(request, 'post').yields('request failed');

                // when
                salesforceLogin.usernamePassword(opts, err => {
                    err.should.equal('Failed to login due to unexpected error.');
                    done();
                });
            });            
        });
    });
});