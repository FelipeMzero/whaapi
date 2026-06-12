import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

let io = null;

// Recebe a instância do Socket.io criada no server.js.
// Clientes entram na "sala" da instância via query: io("ws://host", { query: { instance: "nome" } })
export function init(socketServer) {
  if (!env.websocket.enabled) return;
  io = socketServer;
  io.on('connection', (socket) => {
    const instance = socket.handshake.query?.instance;
    if (instance) {
      socket.join(String(instance));
      logger.debug({ instance }, 'Cliente WebSocket entrou na sala da instância');
    }
  });
  logger.info('Socket.io habilitado');
}

export function publish(instance, event, payload) {
  if (!io) return;
  io.to(instance).emit(event, payload);
  io.emit(`${instance}.${event}`, payload);
}
