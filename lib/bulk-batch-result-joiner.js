const _array = require('lodash/array');

function joinInputResults(results) {
    var success = [];
    var error = [];

    results.forEach(result => {
        success.push(result.success);
        error.push(result.error);
    });

    return {
        success: _array.flatten(success),
        error: _array.flatten(error)
    };
}

function joinQueryResults(results) {
    var flatResults = _array.flatten(results);

    return flatResults.map(result => {
        var newResult = {};
        for(prop in result) {
            if(prop === 'Id') {
                newResult['id'] = result['Id'].toLowerCase();
            } else {
                newResult[prop] = result[prop];
            }
        }
        return newResult;
    });
}

module.exports = {
    joinInputResults,
    joinQueryResults
}