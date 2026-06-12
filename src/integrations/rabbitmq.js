import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

let channel = null;

export async function init() {
  if (!env.rabbitmq.enabled) return;
  try {
    const amqplib = await import('amqplib');
    const conn = await amqplib.connect(env.rabbitmq.uri);
    channel = await conn.createChannel();
    await channel.assertExchange(env.rabbitmq.exchange, 'topic', { durable: true });
    conn.on('close', () => {
      channel = null;
      logger.warn('RabbitMQ desconectado, tentando reconectar em 5s');
      setTimeout(init, 5000);
    });
    logger.info('RabbitMQ conectado');
  } catch (err) {
    logger.error({ err: err.message }, 'Falha ao conectar no RabbitMQ');
    setTimeout(init, 10000);
  }
}

// Publica com routing key "<instancia>.<evento>" (ex: "minha-instancia.messages.upsert")
export async function publish(instance, event, payload) {
  if (!env.rabbitmq.enabled || !channel) return;
  try {
    channel.publish(
      env.rabbitmq.exchange,
      `${instance}.${event}`,
      Buffer.from(JSON.stringify(payload)),
      { contentType: 'application/json', persistent: true }
    );
  } catch (err) {
    logger.error({ err: err.message }, 'Falha ao publicar no RabbitMQ');
  }
}
