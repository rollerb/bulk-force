[![npm package](https://nodei.co/npm/bulk-force.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/bulk-force/)

# bulk-force

After working with the official Salesforce [Data Loader](https://developer.salesforce.com/page/Data_Loader) for a while, it began to show some gaps for how I was needing to move data in and out of my Salesforce environments. Therefore, with the convenience of Node, and an eye on the features I wanted, `bulk-force` was created.

[API Documentation](https://rollerb.github.io/bulk-force)

## Quick Start

Install `bulk-force`:
```
npm install bulk-force --save
```

Bulk query:
```javascript
const bulk = require('bulk-force');
const soql = 'Select Id, Name from Account Limit 1';

bulk.query({ object: 'Account' }, soql, (err, result) => {
	// [{ id: '0014100000ikvdpaaj', Name: 'Grand Hotels & Resorts Ltd' }]
});
```

Bulk insert:
```javascript
const bulk = require('bulk-force');
const opts = {
	action: 'insert',
    object: 'Account'
};
const data = [
	{ Name: 'bulk-force' }
];

bulk.load(opts, data, (err, result) => {
	/* 
    {
		success: [{ Name: 'bulk-force', id: '0014100000ikvdpaaj' }],
        error: []
    }
    */
});
```

## Security

When it comes to security, you can either pass credentials to `bulk-force` or you can setup the correct environment variables that provide the necessary information. The quick start examples above will work if you have the following environment variables setup:

```
SF_CLIENT_ID
SF_CLIENT_SECRET
SF_USERNAME
SF_PASSWORD
SF_SECURITY_TOKEN
```

Alternatively, you can use the login API and pass the result into `bulk-force`:

```javascript
const bulk = require('bulk-force');
const salesforceLogin = bulk.Login;
const opts = {
  clientId: 'client id',
  clientSecret: 'client secret',
  username: 'username',
  password: 'password',
  securityToken: 'security token'
};    

salesforceLogin.usernamePassword(opts, (err, auth) => {
	// { accessToken: 'token', instanceUrl: 'https://instanceUrl' }
    
    const soql = 'Select Id, Name from Account Limit 1';
    const queryOpts = {
    	object: 'Account',
        auth
    };

    bulk.query(queryOpts, soql, (err, result) => {
        // [{ id: '0014100000ikvdpaaj', Name: 'Grand Hotels & Resorts Ltd' }]
    });    
}
```


## Options
