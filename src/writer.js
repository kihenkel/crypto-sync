const fsPromises = require('fs').promises;
const path = require('path');

const writeFile = (filePath, content) => {
  return fsPromises.writeFile(path.resolve(filePath), content);
};

module.exports = {
  writeFile,
};
