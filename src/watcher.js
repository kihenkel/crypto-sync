const path = require('path');
const chokidar = require('chokidar');
const syncer = require('./syncer');
const logger = require('./logger');

const IGNORE_TIMEOUT = 10 * 1000; // 30 seconds

const eventMap = {
  add: (...args) => syncer.addOrUpdate(...args),
  change: (...args) => syncer.addOrUpdate(...args),
  addDir:  (...args) => syncer.addDir(...args),
  unlink: (...args) => syncer.remove(...args),
  unlinkDir: (...args) => syncer.removeDir(...args),
};

const isSamePath = (pathA, pathB) => {
  if (!pathA || !pathB) return false;
  return path.normalize(pathA) === path.normalize(pathB);
};

const isSameEvent = (eventA, eventB) => {
  if (!eventA || !eventB) return false;
  return eventA.toLowerCase() === eventB.toLowerCase();
};

const ignoredEvents = [];
const ignoreNextEvent = (fullPath, event) => {
  const ignoredEvent = { path: fullPath, event };
  const timeoutId = setTimeout(() => {
    if (ignoredEvents.includes(ignoredEvent)) {
      logger.warning(`Did not receive a sync event '${event}' for path '${fullPath}' after ${IGNORE_TIMEOUT}ms!`);
      logger.warning(`Change probably didn't happen. Un-ignoring event ...`);
      ignoredEvents.splice(ignoredEvents.indexOf(ignoredEvent), 1);
    }
  }, IGNORE_TIMEOUT);
  ignoredEvent.timeoutId = timeoutId;
  ignoredEvents.push(ignoredEvent);
};

const isIgnored = (fullPath, event) => {
  const index = ignoredEvents.findIndex(item => isSamePath(item.path, fullPath) && isSameEvent(item.event, event));
  if (index < 0) return false;
  clearTimeout(ignoredEvents[index].timeoutId);
  ignoredEvents.splice(index, 1);
  return true;
};

let watcherInstance;
const watchFolder = (sourcePath, targetPath, isSource, key) => {
  const watchPath = isSource ? sourcePath : targetPath;
  logger.info(`Watching ${watchPath} ...`);
  const options = {
    ignoreInitial: true,
    ignored: /(^|[\/\\])(\.|\~)./,
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 500
    },
  };
  watcherInstance = chokidar.watch(watchPath, options).on('all', (event, data) => {
    const fullPath = path.resolve(data);
    if (isIgnored(fullPath, event)) {
      return;
    }
    logger.verbose(`[FILE SYSTEM] Event '${event}' on path '${fullPath}'!`);
    if (!eventMap[event]) {
      logger.warning(`=> Watch event '${event}' is not supported!`);
      return;
    }

    eventMap[event](fullPath, sourcePath, targetPath, isSource, key)
      .then(({ syncedPath }) => {
        ignoreNextEvent(syncedPath, event);
      })
      .catch((error) => {
        logger.error(`Error while reacting to file change event '${event}' on path '${fullPath}'!`);
        logger.error(error);
      });
  })
  .on('error', (error) => {
    logger.error('File watcher reported error:', error);
  });
};

const close = () => {
  logger.verbose('Unwatching all files.');
  return watcherInstance.close();
};

module.exports = {
  watchFolder,
  close,
};
