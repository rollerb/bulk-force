const _array = require('lodash/array');

function join(results) {
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

module.exports = {
    join
}