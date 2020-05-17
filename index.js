const init = require('./init');
const reader = require('./src/reader');
const syncer = require('./src/syncer');
const syncFileService = require('./src/syncFileService');
const cryptor = require('./src/cryptor');
const watcher = require('./src/watcher');
const logger = require('./src/logger');

const unexpectedSyncfile = async (sourcePath, targetPath) => {
  logger.warning(`Unexpected syncfile found! Were both folders synced in the past on this machine?`);
  await syncFileService.remove(sourcePath, targetPath);
};

const newSyncEncrypt = async (sourcePath, targetPath, key) => {
  logger.info(`New setup! Syncing & encrypting ${sourcePath} => ${targetPath} ...`);
  const syncResult = await syncer.sync(sourcePath, targetPath, { key, shouldDecrypt: false });
  await syncFileService.save(sourcePath, targetPath, syncResult);
};

const newSyncDecrypt = async (sourcePath, targetPath, key) => {
  logger.info(`New setup! Syncing & decrypting ${targetPath} => ${sourcePath} ...`);
  const syncResult = await syncer.sync(targetPath, sourcePath, { key, shouldDecrypt: true, invertSyncResult: true });
  await syncFileService.save(sourcePath, targetPath, syncResult);
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
      let syncfile = await syncFileService.get(sourcePath, targetPath);
      if (sourceExists && !targetExists) {
        if (syncfile.existed) {
          await unexpectedSyncfile(sourcePath, targetPath);
          syncfile = syncFileService.getEmptySyncfile();
        }
        await newSyncEncrypt(sourcePath, targetPath, key);
      } else if (!sourceExists && targetExists) {
        if (syncfile.existed) {
          await unexpectedSyncfile(sourcePath, targetPath);
          syncfile = syncFileService.getEmptySyncfile();
        }
        await newSyncDecrypt(sourcePath, targetPath, key);
      }

      watcher.watchFolder(sourcePath, targetPath, true, key);
      watcher.watchFolder(targetPath, sourcePath, false, key);
    })
    .catch(error => {
      logger.error('Error while running crypto-sync:', error);
      logger.error('Aborting ...');
    });
};

start(process.argv.slice(2));