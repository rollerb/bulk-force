"use strict";

const properties = require('properties-parser');
const merge = require('merge');

function map(mapFile, data) {
    var mappings = properties.read(mapFile);
    var mappedData = data.map(item => {
        let mappedItem = merge(true, item);
        
        for (let currentPropName in mappings) {
            let propValue = mappedItem[currentPropName];
            let newPropName = mappings[currentPropName];
            let hardcodedValue = currentPropName.match(/\[value\](.+)/);

            if (hardcodedValue) {
                propValue = hardcodedValue[1];
            }

            delete mappedItem[currentPropName];
            mappedItem[newPropName] = propValue;
        }
        
        return mappedItem;
    });

    return mappedData;
}

module.exports = {
    map
}