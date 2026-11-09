const path = require('path');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
// Always use the binary cached under server/node_modules, whatever directory Jest
// is started from; otherwise mongodb-memory-server re-downloads ~780 MB.
process.env.MONGOMS_DOWNLOAD_DIR = path.join(__dirname, '..', 'node_modules', '.cache', 'mongodb-memory-server');
