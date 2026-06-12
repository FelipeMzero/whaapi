import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

let client = null;
let SendMessageCommand = null;

export async function init() {
  if (!env.sqs.enabled || !env.sqs.queueUrl) return;
  try {
    const sdk = await import('@aws-sdk/client-sqs');
    SendMessageCommand = sdk.SendMessageCommand;
    client = new sdk.SQSClient({
      region: env.sqs.region,
      credentials: env.sqs.accessKeyId
        ? { accessKeyId: env.sqs.accessKeyId, secretAccessKey: env.sqs.secretAccessKey }
        : undefined,
    });
    logger.info('Amazon SQS configurado');
  } catch (err) {
    logger.error({ err: err.message }, 'Falha ao configurar SQS');
  }
}

export async function publish(instance, event, payload) {
  if (!client) return;
  try {
    const isFifo = env.sqs.queueUrl.endsWith('.fifo');
    await client.send(
      new SendMessageCommand({
        QueueUrl: env.sqs.queueUrl,
        MessageBody: JSON.stringify(payload),
        MessageAttributes: {
          instance: { DataType: 'String', StringValue: instance },
          event: { DataType: 'String', StringValue: event },
        },
        ...(isFifo && {
          MessageGroupId: instance,
          MessageDeduplicationId: `${instance}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        }),
      })
    );
  } catch (err) {
    logger.error({ err: err.message }, 'Falha ao publicar no SQS');
  }
}
