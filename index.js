const init = require('./init');
const reader = require('./src/reader');
const syncer = require('./src/syncer');
const syncFileService = require('./src/syncFileService');
const cryptor = require('./src/cryptor');
const watcher = require('./src/watcher');
const comparer = require('./src/comparer');
const logger = require('./src/logger');

const unexpectedSyncfile = async (sourcePath, targetPath) => {
  logger.warning(`Unexpected syncfile found! Were both folders synced in the past on this machine?`);
  await syncFileService.remove(sourcePath, targetPath);
};

const newSyncEncrypt = async (sourcePath, targetPath, key) => {
  logger.info(`New setup! Syncing & encrypting ${sourcePath} => ${targetPath} ...`);
  const syncResult = await syncer.sync(sourcePath, targetPath, { key, isSource: true });
  await syncFileService.save(syncResult, sourcePath, targetPath);
};

const newSyncDecrypt = async (sourcePath, targetPath, key) => {
  logger.info(`New setup! Syncing & decrypting ${targetPath} => ${sourcePath} ...`);
  const syncResult = await syncer.sync(sourcePath, targetPath, { key, isSource: false });
  await syncFileService.save(syncResult, sourcePath, targetPath);
};

const start = (args) => {
  logger.info('Starting crypto-sync ...');
  return init(args)
    .then(async ({ sourcePath, targetPath, keyPath }) => {
      const sourceExists = await reader.folderExists(sourcePath);
      const targetExists = await reader.folderExists(targetPath);
      if (!sourceExists && !targetExists) {
        return Promise.reject(new Error('Either the watch folder or target folder need to exist!'));
      }
      const key = await cryptor.getKey(keyPath);
      const syncfileExisted = await syncFileService.load(sourcePath, targetPath);
      if (sourceExists && !targetExists) { // Only source folder exists
        if (syncfileExisted) {
          await unexpectedSyncfile(sourcePath, targetPath);
        }
        await newSyncEncrypt(sourcePath, targetPath, key);
      } else if (!sourceExists && targetExists) { // Only target folder exists
        if (syncfileExisted) {
          await unexpectedSyncfile(sourcePath, targetPath);
        }
        await newSyncDecrypt(sourcePath, targetPath, key);
      } else if (syncfileExisted) { // Both folders and syncfile exist (most common path)
        logger.info('Validating sync ...');
        await comparer.compareConnections(sourcePath, targetPath, syncFileService.getSyncfile(), key);
      } else { // Both folders but no syncfile exist
        logger.error('Both folders exist but no syncfile found! Cannot establish a sync connection.');
        logger.error('You need to manually resolve this by deleting one folder. An empty folder is not sufficient.');
        logger.error('Make sure that the remaining data is up to date to prevent data loss.');
        return;
      }

      watcher.watchFolder(sourcePath, targetPath, true, key);
      watcher.watchFolder(sourcePath, targetPath, false, key);
    })
    .catch(error => {
      logger.error('Error while running crypto-sync:', error);
      logger.error('Aborting ...');
    });
};

start(process.argv.slice(2));