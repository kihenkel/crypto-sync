const path = require('path');
const logger = require('./src/logger');
const getParam = require('./src/getParam');

module.exports = (args) => {
  const sourcePathRaw = getParam(['-w', '--watch'], args);
  const targetPathRaw = getParam(['-t', '--target'], args);
  const keyPathRaw = getParam(['-k', '--key'], args);
  
  if (!sourcePathRaw || !targetPathRaw || !keyPathRaw) {
    return Promise.reject('You need to define a valid watch folder (-w), target (-t) and key (-k)!');
  }
  const sourcePath = path.resolve(sourcePathRaw);
  logger.info(`Source folder (unencrypted): ${sourcePath}`);
  const targetPath = path.resolve(targetPathRaw);
  logger.info(`Target folder (encrypted): ${targetPath}`);
  const keyPath = path.resolve(keyPathRaw);
  logger.info(`Path to key file: ${keyPath}`);
  return Promise.resolve({ sourcePath, targetPath, keyPath });
};