const async = require('async');
const request = require('request');

const OBJECT_PATH = 'services/data/v20.0/sobjects';

function deleteRecords(opts, records, cb) {
    async.each(records, (record, callback) => {
        var url = `${opts.auth.instanceUrl}/${OBJECT_PATH}/${opts.object}/${record.id}`;
        
        request.delete(url, {
            json: true,
            headers: {
                Authorization: `Bearer ${opts.auth.accessToken}`
            }
        }, (err, http, body) => {
            if(err) {
                callback(`Failed to delete record ${record.id} from ${opts.object} due to unexpected error: ${err}`);
            } else if (http.statusCode != 204) {
                callback(`Failed to delete record ${record.id} from ${opts.object}. Error received: ${body[0].errorCode}; ${body[0].message}`);
            } else {
                callback();
            }
        });
    }, err => {
        cb(err);
    });
}

exports.deleteRecords = deleteRecords;