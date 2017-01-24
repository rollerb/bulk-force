const request = require('request');
const error = require('debug')('bulk-force:login-api:error');

const PROD_HOST = 'https://login.salesforce.com';
const OAUTH_PATH = '/services/oauth2/token'; 

function usernamePassword(opts, cb) {
    var url = PROD_HOST + OAUTH_PATH;

    if(!opts.username) {
        opts = {
            clientId: process.env.SF_CLIENT_ID,
            clientSecret: process.env.SF_CLIENT_SECRET,
            username: process.env.SF_USERNAME,
            password: process.env.SF_PASSWORD,
            securityToken: process.env.SF_SECURITY_TOKEN
        };
    }
    
    request.post(url, { 
        qs: {
            grant_type: 'password',
            client_id: opts.clientId,
            client_secret: opts.clientSecret,
            username: opts.username,
            password: opts.password + opts.securityToken
        },
        json: true
    }, (err, http, body) => {
        if(err) {
            error('Unexpected request error: %O', err);
            cb('Failed to login due to unexpected error.');
        } else if(http.statusCode != 200) {
            error('Received non-200 response code %s with the message %s', http.statusCode, body);
            cb('Failed to login due to error received from Salesforce. Please check your credentials provided.');
        } else {
            cb(null, {
                accessToken: body.access_token,
                instanceUrl: body.instance_url
            });            
        }
    });
}

exports.usernamePassword = usernamePassword;