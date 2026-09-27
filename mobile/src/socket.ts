import { io, Socket } from 'socket.io-client';

const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL ?? 'http://localhost:4000';

let socket: Socket | null = null;

/** Lazily creates a single shared socket connection for the app's lifetime. */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(SERVER_URL, { transports: ['websocket'] });
  }
  return socket;
}
