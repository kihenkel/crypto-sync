const crypto = require('crypto');
const fsPromises = require('fs').promises;

const start = (secret) => {
  const content = crypto.createHash('sha256').update(String(secret)).digest('hex').slice(0, 32);
  return fsPromises.writeFile('myKey', content);
};

start(crypto.randomBytes(32));