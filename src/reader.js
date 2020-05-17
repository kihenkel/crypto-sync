const fsPromises = require('fs').promises;
const path = require('path');
const logger = require('./logger');

const folderExists = (fullPath) => {
  return fsPromises.stat(path.resolve(fullPath))
    .then(() => true)
    .catch(() => false);
};

module.exports = {
  folderExists,
};
