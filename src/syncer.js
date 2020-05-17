const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const fileTreeCrawler = require('file-tree-crawler');
const cryptor = require('./cryptor');
const syncFileService = require('./syncFileService');
const logger = require('./logger');

const isDebug = false;
logger.verbose(`Debug is ${isDebug ? 'ON' : 'OFF'}!`);

const getSyncId = (sourcePath, targetPath, isSource) =>
  isSource ? cryptor.getChecksum(`${sourcePath}${targetPath}`) : cryptor.getChecksum(`${targetPath}${sourcePath}`);

const getTargetPath = (fullPath, sourceRoot, targetRoot, isSource) => {
  const actualSourceRoot = isSource ? sourceRoot : targetRoot;
  const actualTargetRoot = isSource ? targetRoot : sourceRoot;
  if (!fullPath.startsWith(actualSourceRoot)) {
    logger.error(`Source path ${fullPath} doesn't contain sourceRoot ${actualSourceRoot}!`);
    return;
  }
  return `${actualTargetRoot}${fullPath.slice(actualSourceRoot.length)}`;
};

const createDir = (targetPath) => {
  logger.info(`Creating directory: ${targetPath} ...`);
  return isDebug ? Promise.resolve() : fsPromises.mkdir(path.resolve(targetPath), { recursive: true });
};

const deleteDir = (targetPath, retries = 0) => {
  const MAX_RETRIES = 5;
  const RETRY_DELAY = 1000;
  logger.info(`Deleting directory: ${targetPath} ...`);
  return isDebug ? Promise.resolve() : fsPromises.rmdir(path.resolve(targetPath))
    .catch((err) => {
      if (err && err.code === 'ENOTEMPTY' && retries < MAX_RETRIES) {
        logger.info(`Deleting folder failed ${retries + 1} times because folder is not empty. Will try again in ${RETRY_DELAY}ms ...`)
        return new Promise((resolve) => {
          setTimeout(() => deleteDir(targetPath, retries + 1).then(resolve), RETRY_DELAY);
        });
      }
      throw err;
    });
};

const copyFile = async (sourcePath, targetPath, options) => {
  logger.info(`${options.isSource ? 'Encrypting' : 'Decrypting'} and copying file: ${sourcePath} -> ${targetPath} ...`);

  return options.isSource ?
    cryptor.encrypt(sourcePath, targetPath, options.key) :
    cryptor.decrypt(sourcePath, targetPath, options.key);
};

const syncItem = async (item, sourceRoot, targetRoot, options) => {
  const targetPath = getTargetPath(item.fullPath, sourceRoot, targetRoot, options.isSource);
  if (item.type === 'dir') {
    await createDir(targetPath);
    return item.children.reduce((acc, child) => 
      acc.then(async (files) => {
        const syncResult = await syncItem(child, sourceRoot, targetRoot, options);
        return { ...files, ...syncResult };
      }),
      Promise.resolve({})
    );
  } else {
    const { sourceChecksum } = await copyFile(item.fullPath, targetPath, options);
    const targetChecksum = await cryptor.getChecksumForFile(targetPath);
    const id = getSyncId(item.fullPath, targetPath, options.isSource);
    return options.isSource ?
      { [id]: { sourcePath: item.fullPath, sourceChecksum: sourceChecksum, targetPath: targetPath, targetChecksum: targetChecksum } } :
      { [id]: { sourcePath: targetPath, sourceChecksum: targetChecksum, targetPath: item.fullPath, targetChecksum: sourceChecksum } };
  }
};

const syncTree = async (fileTree, sourceRoot, targetRoot, options) => {
  const shouldExistFolder = options.isSource ? sourceRoot : targetRoot;
  const newFolder = options.isSource ? targetRoot : sourceRoot;
  await fsPromises.stat(path.resolve(shouldExistFolder)).catch(logger.error);
  await fsPromises.stat(path.resolve(newFolder)).catch(() => createDir(newFolder));
  return fileTree.children.reduce((acc, item) => {
    return acc.then(async (files) => {
      const syncResult = await syncItem(item, sourceRoot, targetRoot, options);
      return { ...files, ...syncResult };
    });
  }, Promise.resolve({}));
};

const sync = async (sourcePath, targetPath, options = {}) => {
  const fileTree = await fileTreeCrawler(options.isSource ? sourcePath: targetPath);
  const filesSynced = await syncTree(fileTree, sourcePath, targetPath, options);
  return { connections: filesSynced };
};

// Watch events
const addOrUpdate = async (fullPath, sourceRoot, targetRoot, isSource, key) => {
  const targetPath = getTargetPath(fullPath, sourceRoot, targetRoot, isSource);
  const filesSynced = await syncItem({ type: 'file', fullPath: fullPath }, sourceRoot, targetRoot, { key, isSource });
  await syncFileService.updateAndSave(filesSynced, sourceRoot, targetRoot);
  return { syncedPath: targetPath };
};

const addDir = async (fullPath, sourceRoot, targetRoot, isSource) => {
  const targetPath = getTargetPath(fullPath, sourceRoot, targetRoot, isSource);
  await createDir(targetPath);
  return { syncedPath: targetPath };
};

const removeDir = async (fullPath, sourceRoot, targetRoot, isSource) => {
  const targetPath = getTargetPath(fullPath, sourceRoot, targetRoot, isSource);
  return fsPromises.stat(targetPath)
    .then(() => deleteDir(targetPath))
    .then(() => ({ syncedPath: targetPath }))
    .catch((error) => {
      logger.error(`Failed to delete directory ${targetPath}!`);
      throw error;
    });
};

const remove = async (fullPath, sourceRoot, targetRoot, isSource) => {
  const targetPath = getTargetPath(fullPath, sourceRoot, targetRoot, isSource);
  const id = getSyncId(fullPath, targetPath, isSource);
  return fsPromises.stat(targetPath)
    .then(() => fsPromises.unlink(targetPath))
    .then(() => syncFileService.removeAndSave(id, sourceRoot, targetRoot))
    .then(() => ({ syncedPath: targetPath }))
    .catch((error) => {
      logger.error(`Failed to delete ${targetPath}!`);
      throw error;
    });
};

module.exports = {
  sync,
  addOrUpdate,
  addDir,
  removeDir,
  remove,
};
