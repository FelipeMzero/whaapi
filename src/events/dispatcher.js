import { getSettings } from '../utils/settings.store.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import * as webhook from '../integrations/webhook.js';
import * as socketio from '../integrations/socketio.js';
import * as rabbitmq from '../integrations/rabbitmq.js';
import * as kafka from '../integrations/kafka.js';
import * as sqs from '../integrations/sqs.js';
import * as typebot from '../integrations/typebot.js';
import * as chatwoot from '../integrations/chatwoot.js';
import * as dify from '../integrations/dify.js';
import * as openaiBot from '../integrations/openai.js';

// "sender" é registrado pelo instance.manager para evitar import circular.
// Interface: { sendText, sendMedia, sendAudio }
let sender = null;
export function registerSender(s) {
  sender = s;
}
export function getSender() {
  return sender;
}

// Distribui todo evento para os transportes (webhook, websocket, filas)
// e aciona os chatbots quando for mensagem recebida.
export async function dispatch(instance, event, data) {
  const settings = getSettings(instance);
  const payload = {
    event,
    instance,
    data,
    date: new Date().toISOString(),
    serverUrl: env.server.url,
    apiName: 'WhaAPI',
  };

  const results = await Promise.allSettled([
    webhook.publish(settings.webhook, event, payload),
    Promise.resolve(socketio.publish(instance, event, payload)),
    rabbitmq.publish(instance, event, payload),
    kafka.publish(instance, event, payload),
    sqs.publish(instance, event, payload),
  ]);
  for (const r of results) {
    if (r.status === 'rejected') logger.error({ err: r.reason?.message }, 'Falha em transporte de evento');
  }

  // Chatbots reagem apenas a mensagens recebidas de terceiros
  if (event === 'messages.upsert' && data && !data.fromMe) {
    await Promise.allSettled([
      chatwoot.onMessage(instance, settings.chatwoot, data),
      typebot.onMessage(instance, settings.typebot, data, sender),
      dify.onMessage(instance, settings.dify, data, sender),
      openaiBot.onMessage(instance, settings.openai, data, sender),
    ]);
  }
}
