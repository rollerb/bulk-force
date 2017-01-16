const salesforceLogin = require('../../lib/salesforce-login-api');
const request = require('request');
const chai = require('chai');

chai.should();

describe('salesforce-login-api:integration', () => {
    const ACCOUNT_PATH = '/services/data/v28.0/sobjects/Account';

    describe('#usernamePassword(opts, cb)', () => {
        it('should login and use session to access secure SF calls', (done) => {
            var opts = {
                clientId: process.env.sf_client_id,
                clientSecret: process.env.sf_client_secret,
                username: process.env.sf_username,
                password: process.env.sf_password,
                securityToken: process.env.sf_security_token
            };    

            salesforceLogin.usernamePassword(opts, (err, response) => {
                var accessToken = response.accessToken;
                var instanceUrl = response.instanceUrl;

                request.get(instanceUrl + ACCOUNT_PATH, {
                    headers: {
                        Authorization: `Bearer ${accessToken}`
                    }
                }, (err, http) => {
                    http.statusCode.should.equal(200);
                    done();
                });
            });
        });
    });
});