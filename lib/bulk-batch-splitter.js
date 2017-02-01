const _array = require('lodash/array');
const csv = require('csvtojson');
const debug = require('debug')('bulk-force:bulk-batch-splitter');

const DEFAULT_MAX_SIZE = 2000;

function processSplit(maxBatchSize, data) {
    maxBatchSize = maxBatchSize || DEFAULT_MAX_SIZE;
    debug('using batch size of %d', maxBatchSize);
    var batches = _array.chunk(data, maxBatchSize);
    debug('split data into %d batches', batches.length);
    return batches;
}

function split(opts, data, cb) {
    if (opts.contentType === 'CSV') {
        var file = data;

        csv().fromFile(file, (err, data) => {
            if (err) {
                err = `Unable to split data into batches due to error: ${err}`;
                debug(err);
                cb(err);
            } else {
                cb(null, processSplit(opts.maxBatchSize, data));
            }
        });
    } else {
        cb(null, processSplit(opts.maxBatchSize, data));
    }
}

module.exports = {
    split
};