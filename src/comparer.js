const path = require('path');
const fileTreeCrawler = require('file-tree-crawler');
const cryptor = require('./cryptor');
const syncFileService = require('./syncFileService');
const syncer = require('./syncer');
const logger = require('./logger');

const isSameChecksum = (checksumA, checksumB) => checksumA === checksumB;
const isSamePath = (pathA, pathB) => {
  if (!pathA || !pathB) return false;
  return path.normalize(pathA) === path.normalize(pathB);
};

const compareFileTrees = async (connections, sourceRoot, targetRoot, key) => {
  const sourceTree = await fileTreeCrawler(sourceRoot, { flatMap: true });
  const targetTree = await fileTreeCrawler(targetRoot, { flatMap: true });
  const connectionList = Object.values(connections);
  const existingSourceFiles = connectionList.map(connection => connection.sourcePath);
  const existingTargetFiles = connectionList.map(connection => connection.targetPath);

  await sourceTree.children.reduce((acc, item) => {
    return acc.then(async () => {
      if (!existingSourceFiles.some(existingPath => isSamePath(existingPath, item.fullPath))) {
        logger.info(`Detected NEW file! Syncing source file '${item.fullPath}' (unencrypted) ...`);
        await syncer.addOrUpdate(item.fullPath, sourceRoot, targetRoot, true, key);
      }
    });
  }, Promise.resolve());

  await targetTree.children.reduce((acc, item) => {
    return acc.then(async () => {
      if (!existingTargetFiles.some(existingPath => isSamePath(existingPath, item.fullPath))) {
        logger.info(`Detected NEW file! Syncing target file '${item.fullPath}' (encrypted) ...`);
        await syncer.addOrUpdate(item.fullPath, sourceRoot, targetRoot, false, key);
      }
    });
  }, Promise.resolve());
};

const compareChecksums = async (connections, sourceRoot, targetRoot, key) => {
  return Object.entries(connections).reduce((acc, [id, connection]) => {
    return acc.then(async () => {
      const sourceChecksum = await cryptor.getChecksumForFile(connection.sourcePath);
      const targetChecksum = await cryptor.getChecksumForFile(connection.targetPath);

      if (!sourceChecksum && !targetChecksum) {
        logger.warning(`Looks like ${connection.sourcePath} and ${connection.targetPath} both have been deleted by another source.`);
        logger.warning(`Connection will be removed. Please make sure files are not being altered externally.`);
        return syncFileService.removeAndSave(id, sourceRoot, targetRoot);
      }

      const isSameSourceChecksum = isSameChecksum(sourceChecksum, connection.sourceChecksum);
      const isSameTargetChecksum = isSameChecksum(targetChecksum, connection.targetChecksum);
      if (!isSameSourceChecksum && !isSameTargetChecksum) {
        logger.error(`Both checksums for ${connection.sourcePath} and ${connection.targetPath} differ!`);
        logger.error(`The files might have been changed from another source. Cannot establish a sync connection, aborting ...`);
        return Promise.reject(new Error(`Cannot establish a sync connection because two connected files have changed externally.`));
      }
      if (!isSameSourceChecksum) {
        if (sourceChecksum) {
          logger.info(`Detected CHANGED file! Syncing source file '${connection.sourcePath}' (unencrypted) ...`);
          await syncer.addOrUpdate(connection.sourcePath, sourceRoot, targetRoot, true, key);
        } else {
          logger.info(`Detected DELETED file! Syncing source file '${connection.sourcePath}' (unencrypted) ...`);
          await syncer.remove(connection.sourcePath, sourceRoot, targetRoot, true);
        }
      }
      if (!isSameTargetChecksum) {
        if (targetChecksum) {
          console.log(1, 'path', connection.targetPath, 'file:', targetChecksum, ', from syncfile:', connection.targetChecksum)
          logger.info(`Detected CHANGED file! Syncing target file '${connection.targetPath}' (encrypted) ...`);
          await syncer.addOrUpdate(connection.targetPath, sourceRoot, targetRoot, false, key);
        } else {
          logger.info(`Detected DELETED file! Syncing target file '${connection.targetPath}' (encrypted) ...`);
          await syncer.remove(connection.targetPath, sourceRoot, targetRoot, false);
        }
      }
    });
  }, Promise.resolve());
};

const compareConnections = async (sourceRoot, targetRoot, syncfile, key) => {
  logger.info('Comparing existing connections ...');
  const { connections } = syncfile;
  await compareChecksums(connections, sourceRoot, targetRoot, key);

  logger.info('Checking for new connections ...');
  await compareFileTrees(connections, sourceRoot, targetRoot, key);
};

module.exports = {
  compareConnections,
};
