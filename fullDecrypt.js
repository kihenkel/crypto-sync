const init = require('./init');
const logger = require('./src/logger');
const syncer = require('./src/syncer');
const cryptor = require('./src/cryptor');

const start = (args) => {
  logger.info('Starting full decrypt ...');
  return init(args)
    .then(async ({ sourcePath, targetPath, keyPath }) => {
      const key = await cryptor.getKey(keyPath);
      return syncer.sync(targetPath, sourcePath, { key, shouldDecrypt: true });
    })
    .catch(error => {
      logger.error('Error while running full decrypt:', error);
      logger.error('Aborting ...');
    });
};

start(process.argv.slice(2));