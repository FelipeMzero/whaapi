import 'dotenv/config';

const bool = (v, d = false) =>
  v === undefined || v === '' ? d : ['true', '1', 'yes'].includes(String(v).toLowerCase());

export const env = {
  server: {
    port: Number(process.env.PORT || 8080),
    httpsPort: Number(process.env.HTTPS_PORT || 8443),
    sslCert: process.env.SSL_CERT || '',
    sslKey: process.env.SSL_KEY || '',
    url: process.env.SERVER_URL || `http://localhost:${process.env.PORT || 8080}`,
  },
  auth: {
    apiKey: process.env.API_KEY || 'whaapi-change-me',
  },
  cloudapi: {
    token: process.env.CLOUDAPI_TOKEN || '',
    verifyToken: process.env.CLOUDAPI_VERIFY_TOKEN || 'whaapi-verify',
    version: process.env.CLOUDAPI_VERSION || 'v20.0',
  },
  rabbitmq: {
    enabled: bool(process.env.RABBITMQ_ENABLED),
    uri: process.env.RABBITMQ_URI || 'amqp://guest:guest@localhost:5672',
    exchange: process.env.RABBITMQ_EXCHANGE || 'whaapi.events',
  },
  kafka: {
    enabled: bool(process.env.KAFKA_ENABLED),
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(',').filter(Boolean),
    clientId: process.env.KAFKA_CLIENT_ID || 'whaapi',
    topic: process.env.KAFKA_TOPIC || 'whaapi-events',
  },
  sqs: {
    enabled: bool(process.env.SQS_ENABLED),
    region: process.env.SQS_REGION || 'us-east-1',
    queueUrl: process.env.SQS_QUEUE_URL || '',
    accessKeyId: process.env.SQS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.SQS_SECRET_ACCESS_KEY || '',
  },
  s3: {
    enabled: bool(process.env.S3_ENABLED),
    endpoint: process.env.S3_ENDPOINT || '',
    region: process.env.S3_REGION || 'us-east-1',
    bucket: process.env.S3_BUCKET || 'whaapi',
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    forcePathStyle: bool(process.env.S3_FORCE_PATH_STYLE, true),
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },
  websocket: {
    enabled: bool(process.env.WEBSOCKET_ENABLED, true),
  },
  logLevel: process.env.LOG_LEVEL || 'info',
};
