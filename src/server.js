import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import express from 'express';
import { Server as SocketServer } from 'socket.io';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { apiKeyAuth } from './api/middlewares/auth.js';
import instanceRoutes from './api/routes/instance.routes.js';
import messageRoutes from './api/routes/message.routes.js';
import integrationsRoutes from './api/routes/integrations.routes.js';
import cloudapiRoutes from './api/routes/cloudapi.routes.js';
import * as manager from './whatsapp/instance.manager.js';
import * as socketio from './integrations/socketio.js';
import * as rabbitmq from './integrations/rabbitmq.js';
import * as kafka from './integrations/kafka.js';
import * as sqs from './integrations/sqs.js';
import * as s3 from './integrations/s3.js';

const app = express();
app.use(express.json({ limit: '50mb' }));

// Site estático (landing page + documentação)
app.use(express.static(path.resolve('site')));

// Rotas públicas (sem apikey): verificação/eventos da Meta e webhook do Chatwoot
app.use('/cloudapi', cloudapiRoutes);

app.get('/health', (req, res) =>
  res.json({ status: 'ok', name: 'WhaAPI', version: '1.0.0', uptime: process.uptime() })
);

// Webhook do Chatwoot precisa ser acessível pelo servidor do Chatwoot sem apikey
app.use((req, res, next) => {
  if (req.path.startsWith('/chatwoot/webhook/')) return next();
  return apiKeyAuth(req, res, next);
});

app.use('/instance', instanceRoutes);
app.use('/message', messageRoutes);
app.use('/', integrationsRoutes);

// Tratamento central de erros
app.use((err, req, res, next) => {
  logger.error({ err: err.message, path: req.path }, 'Erro na requisição');
  const status = /não encontrada|not found/i.test(err.message) ? 404 : 500;
  res.status(status).json({ status, error: err.message });
});

// ── Servidores HTTP e HTTPS ─────────────────────────────────
const httpServer = http.createServer(app);
const servers = [httpServer];

let httpsServer = null;
if (env.server.sslCert && env.server.sslKey && fs.existsSync(env.server.sslCert)) {
  httpsServer = https.createServer(
    { cert: fs.readFileSync(env.server.sslCert), key: fs.readFileSync(env.server.sslKey) },
    app
  );
  servers.push(httpsServer);
}

// Socket.io anexado a ambos os servidores
const io = new SocketServer({ cors: { origin: '*' } });
for (const server of servers) io.attach(server);
socketio.init(io);

// ── Boot ────────────────────────────────────────────────────
async function start() {
  await Promise.allSettled([rabbitmq.init(), kafka.init(), sqs.init(), s3.init()]);
  await manager.init();

  httpServer.listen(env.server.port, () =>
    logger.info(`WhaAPI HTTP ouvindo na porta ${env.server.port}`)
  );
  if (httpsServer) {
    httpsServer.listen(env.server.httpsPort, () =>
      logger.info(`WhaAPI HTTPS ouvindo na porta ${env.server.httpsPort}`)
    );
  }
}

start().catch((err) => {
  logger.fatal({ err: err.message }, 'Falha ao iniciar a WhaAPI');
  process.exit(1);
});
