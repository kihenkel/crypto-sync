const fsPromises = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const logger = require('./logger');

const getSyncFileName = (sourcePath, targetPath) => {
  const sourceHash = crypto.createHash('sha1').update(sourcePath).digest('hex');
  const targetHash = crypto.createHash('sha1').update(targetPath).digest('hex');
  return `syncfile_${sourceHash}-${targetHash}.json`;
};

const save = (sourcePath, targetPath, content) => {
  const fileName = getSyncFileName(sourcePath, targetPath);
  const filePath = path.join(path.resolve('temp'), fileName);
  logger.info(`Saving syncfile ${filePath} ...`);
  return fsPromises.writeFile(filePath, JSON.stringify(content, null, 2));
};

const remove = (sourcePath, targetPath) => {
  const fileName = getSyncFileName(sourcePath, targetPath);
  const filePath = path.join(path.resolve('temp'), fileName);
  logger.info(`Deleting syncfile ${filePath} ...`);
  return fsPromises.unlink(filePath);
};

const get = async (sourcePath, targetPath) => {
  const fileName = getSyncFileName(sourcePath, targetPath);
  const tempFolder = path.resolve('temp');
  await fsPromises.stat(tempFolder)
    .catch(() => {
      logger.info(`Temp folder doesn't exist, creating new one ...`);
      return fsPromises.mkdir(tempFolder);
    });
  const filePath = path.join(tempFolder, fileName);
  logger.info(`Reading syncfile from ${filePath} ...`);
  let existed = true;
  await fsPromises.stat(filePath)
    .catch(() => {
      logger.info(`Syncfile doesn't exist, creating new one ...`);
      existed = false;
      return save(sourcePath, targetPath, {});
    });
  const syncfileRaw = await fsPromises.readFile(filePath);
  const syncfile = JSON.parse(syncfileRaw.toString());
  return { content: syncfile, existed };
};

const getEmptySyncfile = () => ({
  content: {},
  existed: false,
});

module.exports = {
  save,
  remove,
  get,
  getEmptySyncfile,
};
