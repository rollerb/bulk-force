[![npm package](https://nodei.co/npm/bulk-force.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/bulk-force/)

# bulk-force

After working with the official Salesforce [Data Loader](https://developer.salesforce.com/page/Data_Loader) for a while, it became a little painful to do what felt like simple tasks. For example: deleting data conditionally, sorting data to avoid table locking, to name a few. It was with this simplicity that motivated me to use the convenience of Node, and an eye on the features I wanted to create `bulk-force`.

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

When it comes to security, you can either pass credentials to `bulk-force` or you can setup the correct environment variables which provide the necessary security information. The quick start examples above will only work if you have the following environment variables setup:

```
SF_CLIENT_ID
SF_CLIENT_SECRET
SF_USERNAME
SF_PASSWORD
SF_SECURITY_TOKEN
```

Alternatively, you can use the login API and pass the result into `bulkf-force`:

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


## Bulk Load Options

### Load data from CSV file


```javascript
const csvFile = 'data.csv'; // csv file instead of JSON data
const opts = {
	action: 'insert',
    object: 'Account'
};

bulk.load(opts, csvFile, (err, result) => {
	/* 
    {
		success: [{ Name: 'bulk-force', id: '0014100000ikvdpaaj' }],
        error: []
    }
    */
});
```

### Save load result to path

Save result of load to the filesystem, where if the path provided is `./results` and the object you are loading into is `Account`, then the following files will be created: `./results/Account_success.csv` and `./results/Account_error.csv`. The response will return the count of successes, `successCount`, and the count of errors, `errorCount`. Here is how to load data and save the results to a path:

```javascript
const opts = {
	action: 'insert',
    object: 'Account',
    toPath: './results' // path to save results
};
const data = [
	{ Name: 'bulk-force' }
];

bulk.load(opts, data, (err, result) => {
	/*
    {
    	successCount: 1,
        errorCount: 0
    }
    */
});
```

### External field

The following load actions are supported: `insert` and `upsert`. If you are upserting, then the `externalField` is required, as shown here:

```javascript
const opts = {
	action: 'upsert',
    object: 'Account',
    externalField: 'extId__c' // external ID to use when checking for record uniqueness
};
const data = [
	{ Name: 'bulk-force', extId__c: 23 }
];

bulk.load(opts, data, (err, result) => {
	/* 
    {
		success: [{ Name: 'bulk-force', extId__c: 23, id: '0014100000ikvdpaaj' }],
        error: []
    }
    */
});
```

### Max batch size

You can specify the number of records to process per batch by setting the `maxBatchSize` option; otherwise, the default value of `2000` will be used.

```javascript
const csvFile = 'data.csv';
const opts = {
	action: 'upsert',
    object: 'Account',
    maxBatchSize: 1000 // override default batch size
};

bulk.load(opts, csvFile, (err, result) => {
	/* 
    {
		success: [{ Name: 'bulk-force', id: '0014100000ikvdpaaj' }],
        error: []
    }
    */
});
```

### Mapping file

By providing a mapping file, you can map fields and provide hardcoded values. Here is an example mapping file:

```properties
# my_map.properties
customerName=Name
[value]foo=Site # will load the value 'foo' into the field 'Site' for all records processed
```

And this is how you would use the mapping file while loading:

```javascript
const opts = {
	action: 'upsert',
    object: 'Account',
    mapFile: 'my_map.properties' // mapping file to use
};
const data = [
	{ customerName: 'bulk-force' }
];

bulk.load(opts, data, (err, result) => {
	/* 
    {
		success: [{ Name: 'bulk-force', Site: 'foo', id: '0014100000ikvdpaaj' }],
        error: []
    }
    */
});
```

