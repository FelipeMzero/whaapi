import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

let producer = null;

export async function init() {
  if (!env.kafka.enabled) return;
  try {
    const { Kafka } = await import('kafkajs');
    const kafka = new Kafka({ clientId: env.kafka.clientId, brokers: env.kafka.brokers });
    producer = kafka.producer();
    await producer.connect();
    logger.info('Kafka conectado');
  } catch (err) {
    producer = null;
    logger.error({ err: err.message }, 'Falha ao conectar no Kafka');
    setTimeout(init, 10000);
  }
}

export async function publish(instance, event, payload) {
  if (!env.kafka.enabled || !producer) return;
  try {
    await producer.send({
      topic: env.kafka.topic,
      messages: [
        {
          key: instance,
          value: JSON.stringify(payload),
          headers: { event, instance },
        },
      ],
    });
  } catch (err) {
    logger.error({ err: err.message }, 'Falha ao publicar no Kafka');
  }
}
