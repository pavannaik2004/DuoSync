/** In-process events from services to the socket layer (services never import socket code). */
const { EventEmitter } = require('events');

module.exports = new EventEmitter();
