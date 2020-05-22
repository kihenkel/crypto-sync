const crypto = require('crypto');
const zlib = require('zlib');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const AppendIv = require('./AppendIv');

const getChecksum = (content) => {
  return crypto.createHash('sha1').update(content.toString()).digest('hex');
};

const encrypt = (sourcePath, targetPath, key) => {
  return new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(path.resolve(sourcePath));
    const gzipStream = zlib.createGzip();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes256', key, iv);
    const appendIv = new AppendIv(iv);
    const writeStream = fs.createWriteStream(path.resolve(targetPath));

    readStream.on('close', resolve);
    readStream.on('error', reject);
    
    readStream
      .pipe(gzipStream)
      .pipe(cipher)
      .pipe(appendIv)
      .pipe(writeStream);
  });
};

const decrypt = (sourcePath, targetPath, key) => {
  return Promise.resolve()
    .then(() => {
      return new Promise((resolve, reject) => {
        const ivStream = fs.createReadStream(path.resolve(sourcePath), { end: 15 });
        let iv;
        ivStream.on('data', (chunk) => { iv = chunk; });
        ivStream.on('close', () => resolve(iv));
        ivStream.on('error', reject);
      });
    })
    .then((iv) => {
      return new Promise((resolve, reject) => {
        const readStream = fs.createReadStream(path.resolve(sourcePath), { start: 16 });
        const decipher = crypto.createDecipheriv('aes256', key, iv);
        const unzipStream = zlib.createUnzip();
        const writeStream = fs.createWriteStream(path.resolve(targetPath));

        readStream.on('close', resolve);
        readStream.on('error', reject);
        
        readStream
          .pipe(decipher)
          .pipe(unzipStream)
          .pipe(writeStream);
      });
    });
};

const getKey = async (keyPath) => {
  const keyContent = await fsPromises.readFile(path.resolve(keyPath));
  return crypto.createHash('sha256').update(keyContent).digest();
};

const getChecksumForFile = async (fullPath) => {
  return fsPromises.stat(fullPath)
    .then(() => fsPromises.readFile(fullPath))
    .then(getChecksum)
    .catch(() => undefined);
};

module.exports = {
  encrypt,
  decrypt,
  getKey,
  getChecksum,
  getChecksumForFile,
};