import { io } from 'socket.io-client';
import { API_BASE, getToken } from './client';

/** A Socket.io connection to the API, sending the same token as REST (NFR-3). */
export function connectSocket() {
  return io(API_BASE || undefined, { auth: { token: getToken() } });
}
