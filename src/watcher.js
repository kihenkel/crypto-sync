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

const watchFolder = (sourcePath, targetPath, isSource, key) => {
  const watchPath = isSource ? sourcePath : targetPath;
  logger.info(`Watching ${watchPath} ...`);
  const options = {
    ignoreInitial: true,
    ignored: /(^|[\/\\])\../,
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 500
    },
  };
  chokidar.watch(watchPath, options).on('all', (event, data) => {
    if (event === 'error') {
      logger.error('File watcher reported error:', data);
      return;
    }
    const fullPath = path.resolve(data);
    logger.verbose(`Watch event '${event}' on path '${fullPath}'!`);
    if (isIgnored(fullPath, event)) {
      logger.verbose(`=> Event is on ignore list. Ignoring ...`);
      return;
    }
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
  });
};

module.exports = {
  watchFolder,
};
