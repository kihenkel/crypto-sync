const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const fileTreeCrawler = require('file-tree-crawler');
const cryptor = require('./cryptor');
const logger = require('./logger');

const isDebug = false;
logger.verbose(`Debug is ${isDebug ? 'ON' : 'OFF'}!`);

const getTargetPath = (sourcePath, sourceRoot, targetRoot) => {
  if (!sourcePath.startsWith(sourceRoot)) {
    logger.error(`Source path ${sourcePath} doesn't contain sourceRoot ${sourceRoot}!`);
    return;
  }
  return `${targetRoot}${sourcePath.slice(sourceRoot.length)}`;
};

const createDir = (targetPath) => {
  logger.info(`Creating dir: ${targetPath} ...`);
  return isDebug ? Promise.resolve() : fsPromises.mkdir(path.resolve(targetPath), { recursive: true });
};

const copyFile = async (sourcePath, targetPath, options) => {
  logger.info(`${options.shouldDecrypt ? 'Decrypting' : 'Encrypting'} and copying file: ${sourcePath} -> ${targetPath} ...`);

  return options.shouldDecrypt ?
    cryptor.decrypt(sourcePath, targetPath, options.key) :
    cryptor.encrypt(sourcePath, targetPath, options.key);
};

const syncItem = async (item, sourceRoot, targetRoot, options) => {
  const targetPath = getTargetPath(item.fullPath, sourceRoot, targetRoot);
  if (item.type === 'dir') {
    await createDir(targetPath);
    return item.children.reduce((acc, child) => 
      acc.then(async (files) => {
        const syncResult = await syncItem(child, sourceRoot, targetRoot, options);
        return files.concat(syncResult.flat(Infinity));
      }),
      Promise.resolve([])
    );
  } else {
    const { sourceChecksum } = await copyFile(item.fullPath, targetPath, options);
    const targetChecksum = await cryptor.getChecksumForFile(targetPath);
    return options.invertSyncResult ?
      [{ sourcePath: targetPath, sourceChecksum: targetChecksum, targetPath: item.fullPath, targetChecksum: sourceChecksum }] :
      [{ sourcePath: item.fullPath, sourceChecksum: sourceChecksum, targetPath: targetPath, targetChecksum: targetChecksum }];
  }
};

const syncTree = async (sourceTree, targetRoot, options) => {
  const sourceRoot = sourceTree.initialPath;
  await fsPromises.stat(path.resolve(sourceRoot)).catch(logger.error);
  await fsPromises.stat(path.resolve(targetRoot)).catch(() => createDir(targetRoot));
  return sourceTree.children.reduce((acc, item) => {
    return acc.then(async (files) => {
      const syncResult = await syncItem(item, sourceRoot, targetRoot, options);
      return files.concat(syncResult.flat(Infinity));
    });
  }, Promise.resolve([]));
};

const sync = async (sourcePath, targetPath, options = {}) => {
  const sourceTree = await fileTreeCrawler(sourcePath);
  const filesSynced = await syncTree(sourceTree, targetPath, options);
  return { files: filesSynced };
};

// Watch events
const add = async (sourcePath, sourceRoot, targetRoot, isSource, key) => {
  const targetPath = getTargetPath(sourcePath, sourceRoot, targetRoot);
  await copyFile(sourcePath, targetPath, { key, shouldDecrypt: !isSource });
  return { syncedPath: targetPath };
};

const addDir = async (sourcePath, sourceRoot, targetRoot) => {
  const targetPath = getTargetPath(sourcePath, sourceRoot, targetRoot);
  await createDir(targetPath);
  return { syncedPath: targetPath };
};

const remove = async (sourcePath, sourceRoot, targetRoot) => {
  const targetPath = getTargetPath(sourcePath, sourceRoot, targetRoot);
  return fsPromises.stat(targetPath)
    .then(() => fsPromises.unlink(targetPath))
    .then(() => ({ syncedPath: targetPath }))
    .catch((error) => {
      logger.error(`Failed to delete ${targetPath}!`);
      throw error;
    });
};

module.exports = {
  sync,
  add,
  addDir,
  remove,
};
