import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

let client = null;
let PutObjectCommand = null;

export async function init() {
  if (!env.s3.enabled) return;
  try {
    const sdk = await import('@aws-sdk/client-s3');
    PutObjectCommand = sdk.PutObjectCommand;
    client = new sdk.S3Client({
      region: env.s3.region,
      endpoint: env.s3.endpoint || undefined,
      forcePathStyle: env.s3.forcePathStyle,
      credentials: env.s3.accessKeyId
        ? { accessKeyId: env.s3.accessKeyId, secretAccessKey: env.s3.secretAccessKey }
        : undefined,
    });
    logger.info('S3/MinIO configurado');
  } catch (err) {
    logger.error({ err: err.message }, 'Falha ao configurar S3/MinIO');
  }
}

// Envia um buffer de mídia e retorna a URL pública do objeto
export async function upload(instance, fileName, buffer, mimetype) {
  if (!client) return null;
  const key = `${instance}/${Date.now()}-${fileName}`;
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: env.s3.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimetype,
      })
    );
    if (env.s3.endpoint) {
      return `${env.s3.endpoint.replace(/\/$/, '')}/${env.s3.bucket}/${key}`;
    }
    return `https://${env.s3.bucket}.s3.${env.s3.region}.amazonaws.com/${key}`;
  } catch (err) {
    logger.error({ err: err.message }, 'Falha ao enviar mídia para S3/MinIO');
    return null;
  }
}
