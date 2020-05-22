const path = require('path');
const fsPromises = require('fs').promises;
const fileTreeCrawler = require('file-tree-crawler');
const syncFileService = require('./syncFileService');
const syncer = require('./syncer');
const logger = require('./logger');

const COMPARER_THRESHOLD = 5;
const isSameComparer = (a, b) => {
  const diff = a - b;
  return diff >= -COMPARER_THRESHOLD && diff <= COMPARER_THRESHOLD;
};
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

const compareComparer = async (connections, sourceRoot, targetRoot, key) => {
  return Object.entries(connections).reduce((acc, [id, connection]) => {
    return acc.then(async () => {
      const sourceComparer = await syncer.getComparerForFile(connection.sourcePath);
      const targetComparer = await syncer.getComparerForFile(connection.targetPath);

      if (!sourceComparer && !targetComparer) {
        logger.warning(`Looks like ${connection.sourcePath} and ${connection.targetPath} both have been deleted by another source.`);
        logger.warning(`Connection will be removed. Please make sure files are not being altered externally.`);
        return syncFileService.removeAndSave(id, sourceRoot, targetRoot);
      }

      const isSourceSame = isSameComparer(sourceComparer, connection.sourceComparer);
      const isTargetSame = isSameComparer(targetComparer, connection.targetComparer);
      if (!isSourceSame && !isTargetSame) {
        logger.error(`Both files ${connection.sourcePath} and ${connection.targetPath} have been modified!`);
        logger.error(`The files might have been changed from another source. Cannot establish a sync connection, aborting ...`);
        logger.verbose(`Source comparers - From file: ${sourceComparer}, From syncfile: ${connection.sourceComparer}`);
        logger.verbose(`Target comparers - From file: ${targetComparer}, From syncfile: ${connection.targetComparer}`);
        return Promise.reject(new Error(`Cannot establish a sync connection because two connected files have changed externally.`));
      }
      if (!isSourceSame) {
        if (sourceComparer) {
          logger.info(`Detected CHANGED file! Syncing source file '${connection.sourcePath}' (unencrypted) ...`);
          await syncer.addOrUpdate(connection.sourcePath, sourceRoot, targetRoot, true, key);
        } else {
          logger.info(`Detected DELETED file! Syncing source file '${connection.sourcePath}' (unencrypted) ...`);
          await syncer.remove(connection.sourcePath, sourceRoot, targetRoot, true);
        }
      }
      if (!isTargetSame) {
        if (targetComparer) {
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
  await compareComparer(connections, sourceRoot, targetRoot, key);

  logger.info('Checking for new connections ...');
  await compareFileTrees(connections, sourceRoot, targetRoot, key);
  logger.info('Comparing finished!');
};

module.exports = {
  compareConnections,
};
