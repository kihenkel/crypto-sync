const fsPromises = require('fs').promises;
const path = require('path');

const LogLevel = {
  error: 'error',
  warning: 'warning',
  info: 'info',
  verbose: 'verbose',
};

let logLevel = LogLevel.info;

const Color = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

const SAVE_DEBOUNCE_DELAY = 5000;
let debounceId;
let cachedLogs = '';
const logFilePath = path.join(path.resolve('temp'), 'logs.log');
const saveDebounced = (message) => {
  cachedLogs += `${message}\n`;
  if (debounceId) clearTimeout(debounceId);
  debounceId = setTimeout(() => {
    fsPromises.appendFile(logFilePath, cachedLogs);
    debounceId = undefined;
    cachedLogs = '';
  }, SAVE_DEBOUNCE_DELAY);
};

const getLocalTime = () => {
  const now = new Date();
  const isoString = new Date(now.valueOf() - (now.getTimezoneOffset() * 60000)).toISOString();
  return isoString.slice(0, isoString.length - 1);
}

const log = (...msg) => {
  const message = msg.join(' ');
  console.log(` ${message}`);
  saveDebounced(`[${getLocalTime()}] ${message}`);
};

const asColor = (msg, color) =>
  `${color}${msg}${Color.white}`;

const error = (...msg) => {
  log(`[${asColor('ERROR', Color.red)}]`, ...msg);
};

const warning = (...msg) => {
  if ([LogLevel.verbose, LogLevel.info, LogLevel.warning].includes(logLevel)) {
    log(`[${asColor('Warning', Color.yellow)}]`, ...msg);
  }
};

const info = (...msg) => {
  if ([LogLevel.verbose, LogLevel.info].includes(logLevel)) {
    log(...msg);
  }
};

const verbose = (...msg) => {
  if ([LogLevel.verbose].includes(logLevel)) {
    log(...msg);
  }
};

const positive = (tag, ...msg) => {
  log(`[${asColor(tag, Color.green)}]`, ...msg);
};

const negative = (tag, ...msg) => {
  log(`[${asColor(tag, Color.red)}]`, ...msg);
};

const setLogLevel = (newLogLevel) => {
  if (!Object.values(LogLevel).includes(newLogLevel)) {
    error(`Log level ${newLogLevel} doesnt exist.`);
    return;
  }

  log(`Setting log level to ${newLogLevel} ...`);
  logLevel = newLogLevel;
};

module.exports = {
  asColor,
  error,
  warning,
  info,
  verbose,
  positive,
  negative,
  setLogLevel,
  Color,
};
