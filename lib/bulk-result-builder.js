"use strict";

const csv = require('csvtojson');
const merge = require('merge');

function processResults(request, results) {
    var success = [];
    var error = [];

    for(var i = 0; i < results.length; i++) {
        let iRequest = request[i];
        let iResult = results[i];
        let iSuccess = iResult.success || iResult.Success;
        
        if(iSuccess) {
            let id = iResult.id || iResult.Id;
            success.push(merge(true, iRequest, {id}));
        } else {
            let err;
            if(iResult.errors) {
                let errParts = iResult.errors[0];
                err = `${errParts.statusCode}: ${errParts.message}`;
            } else {
                err = iResult.Error;
            }
            
            error.push(merge(true, iRequest, {error: err}));
        }
    }

    return {
        success,
        error
    };
}

function build(request, response, cb) {  
    if(typeof(request) === 'string') {
        csv().fromString(request).on('end_parsed', jsonRequest => {
            csv().fromString(response).on('end_parsed', jsonResult => {
                cb(null, processResults(jsonRequest, jsonResult));
            });
        });
    } else {
        cb(null, processResults(request, response));
    }
}

module.exports = {
    build
}