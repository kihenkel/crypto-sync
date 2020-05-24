const fsPromises = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const logger = require('./logger');

const SAVE_DEBOUNCE_DELAY = 500;
let debounceId;
let writePromise;
const saveDebounced = (content, filePath, fileName) => {
  if (debounceId) {
    clearTimeout(debounceId);
  }
  debounceId = setTimeout(() => {
    if (writePromise) {
      logger.warning(`Triggered new syncfile save but previous write process hasn't finished yet!`);
      logger.warning(`To fix this the save debounce delay should be increased (currently it's ${SAVE_DEBOUNCE_DELAY}ms).`);
    }
    const promise = writePromise || Promise.resolve();
    writePromise = promise.then(() => {
      logger.info(`Saving syncfile ${fileName} ...`);
      debounceId = undefined;
      return fsPromises.writeFile(filePath, JSON.stringify(content, null, 2))
    })
    .then(() => {
      logger.info(`Saved syncfile!`);
      writePromise = undefined;
    });
  }, SAVE_DEBOUNCE_DELAY);
};

let syncfile;

const validateSyncfile = (content) => {
  if (!content) return { connections: {} };
  if (!content.connections) return { ...content, connections: {} };
  return content;
};

const getSyncFileName = (sourcePath, targetPath) => {
  const sourceHash = crypto.createHash('sha1').update(sourcePath).digest('hex');
  const targetHash = crypto.createHash('sha1').update(targetPath).digest('hex');
  return `syncfile_${sourceHash}-${targetHash}.json`;
};

const getTempFolderPath = () => {
  return path.resolve(path.join(__dirname, '..', 'temp'));
};

const save = async (content, sourcePath, targetPath) => {
  const fileName = getSyncFileName(sourcePath, targetPath);
  const filePath = path.join(getTempFolderPath(), fileName);
  saveDebounced(content, filePath, fileName);
  syncfile = content;
};

const remove = async (sourcePath, targetPath) => {
  const fileName = getSyncFileName(sourcePath, targetPath);
  const filePath = path.join(getTempFolderPath(), fileName);
  logger.verbose(`Deleting syncfile ${filePath} ...`);
  await fsPromises.unlink(filePath);
  syncfile = undefined;
};

const load = async (sourcePath, targetPath) => {
  const fileName = getSyncFileName(sourcePath, targetPath);
  const tempFolder = getTempFolderPath();
  await fsPromises.stat(tempFolder)
    .catch(() => {
      logger.verbose(`Temp folder doesn't exist, creating new one ...`);
      return fsPromises.mkdir(tempFolder);
    });
  const filePath = path.join(tempFolder, fileName);
  logger.verbose(`Reading syncfile ${fileName} ...`);
  return fsPromises.stat(filePath)
    .then(() => fsPromises.readFile(filePath))
    .then((syncfileRaw) => {
      syncfile = validateSyncfile(JSON.parse(syncfileRaw.toString()));
      return true;
    })
    .catch(() => {
      logger.info(`No syncfile found!`);
      return false;
    });
};

const getSyncfile = () => syncfile;

const updateAndSave = (content, sourcePath, targetPath) => {
  const id = Object.keys(content)[0];
  if (syncfile.connections[id]) {
    logger.verbose(`[Syncfile] Updating id ${id} ...`);
  } else {
    logger.verbose(`[Syncfile] Adding id ${id} ...`);
  }
  return save({ ...syncfile, connections: { ...syncfile.connections, ...content } }, sourcePath, targetPath);
};

const removeAndSave = (id, sourcePath, targetPath) => {
  logger.verbose(`[Syncfile] Removing id ${id} ...`);
  const syncfileCopy = { ...syncfile, connections: { ...syncfile.connections } };
  if (syncfileCopy.connections[id]) {
    delete syncfileCopy.connections[id];
  }
  return save(syncfileCopy, sourcePath, targetPath);
};

module.exports = {
  save,
  remove,
  load,
  getSyncfile,
  updateAndSave,
  removeAndSave,
};
