const path = require('path');
const logger = require('./logger');
const getParam = require('./getParam');

module.exports = (args) => {
  const verboseMode = getParam(['-v', '--verbose'], args, true);
  if (verboseMode) logger.setLogLevel(logger.LogLevel.verbose);
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