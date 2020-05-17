const init = require('./init');
const logger = require('./src/logger');
const syncer = require('./src/syncer');
const cryptor = require('./src/cryptor');

const start = (args) => {
  logger.info('Starting full encrypt ...');
  return init(args)
    .then(async ({ sourcePath, targetPath, keyPath }) => {
      const key = await cryptor.getKey(keyPath);
      return syncer.sync(sourcePath, targetPath, { key, shouldDecrypt: false });
    })
    .catch(error => {
      logger.error('Error while running full encrypt:', error);
      logger.error('Aborting ...');
    });
};

start(process.argv.slice(2));