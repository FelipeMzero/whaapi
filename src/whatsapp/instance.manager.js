import fs from 'node:fs';
import path from 'node:path';
import qrcode from 'qrcode';
import baileys, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  downloadMediaMessage,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { logger } from '../utils/logger.js';
import { dispatch, registerSender } from '../events/dispatcher.js';
import * as store from '../utils/settings.store.js';
import * as s3 from '../integrations/s3.js';
import * as openai from '../integrations/openai.js';
import * as cloudapi from './cloudapi.service.js';

const makeWASocket = baileys.default || baileys;
const AUTH_DIR = path.resolve('instances');

// instances: name -> { sock, integration, status, qr, qrCode, cloudapi: {phoneNumberId, token} }
const instances = new Map();

const MEDIA_TYPES = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'];

function toJid(number) {
  const n = String(number).replace(/\D/g, '');
  return n.includes('@') ? number : `${n}@s.whatsapp.net`;
}

function extractText(m = {}) {
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.buttonsResponseMessage?.selectedDisplayText ||
    m.listResponseMessage?.title ||
    m.templateButtonReplyMessage?.selectedDisplayText ||
    ''
  );
}

async function normalizeMessage(instanceName, sock, msg) {
  const m = msg.message || {};
  const messageType =
    Object.keys(m).find((k) => !['messageContextInfo', 'senderKeyDistributionMessage'].includes(k)) || 'unknown';

  const data = {
    key: msg.key,
    remoteJid: msg.key.remoteJid,
    number: (msg.key.remoteJid || '').split('@')[0],
    fromMe: !!msg.key.fromMe,
    pushName: msg.pushName || '',
    messageType,
    text: extractText(m),
    timestamp: Number(msg.messageTimestamp) || Math.floor(Date.now() / 1000),
    isGroup: (msg.key.remoteJid || '').endsWith('@g.us'),
    source: 'BAILEYS',
    message: m,
  };

  // Mídia: baixa, envia ao S3/MinIO e transcreve áudio com OpenAI quando configurado
  if (MEDIA_TYPES.includes(messageType)) {
    try {
      const media = m[messageType];
      const mimetype = media?.mimetype || 'application/octet-stream';
      const buffer = await downloadMediaMessage(msg, 'buffer', {}, {
        logger,
        reuploadRequest: sock.updateMediaMessage,
      });
      const ext = mimetype.split('/')[1]?.split(';')[0] || 'bin';
      const fileName = media?.fileName || `${msg.key.id}.${ext}`;
      const url = await s3.upload(instanceName, fileName, buffer, mimetype);
      if (url) data.mediaUrl = url;

      const openaiCfg = store.getSection(instanceName, 'openai');
      if (messageType === 'audioMessage' && (openaiCfg?.speechToText || openaiCfg?.enabled)) {
        const transcription = await openai.transcribe(buffer, mimetype, openaiCfg);
        if (transcription) {
          data.transcription = transcription;
          if (!data.text) data.text = transcription;
        }
      }
    } catch (err) {
      logger.error({ err: err.message }, 'Falha ao processar mídia recebida');
    }
  }

  return data;
}

async function startBaileys(name) {
  const authPath = path.join(AUTH_DIR, name);
  fs.mkdirSync(authPath, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(authPath);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: logger.child({ instance: name, module: 'baileys' }),
    browser: ['WhaAPI', 'Chrome', '1.0.0'],
    syncFullHistory: false,
  });

  const inst = instances.get(name) || { integration: 'BAILEYS' };
  inst.sock = sock;
  inst.status = 'connecting';
  instances.set(name, inst);

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      inst.qr = qr;
      inst.qrCode = await qrcode.toDataURL(qr);
      inst.status = 'qrcode';
      dispatch(name, 'qrcode.updated', { qr });
    }

    if (connection === 'open') {
      inst.status = 'open';
      inst.qr = null;
      inst.qrCode = null;
      logger.info({ instance: name }, 'Instância conectada ao WhatsApp');
      dispatch(name, 'connection.update', { state: 'open' });
    }

    if (connection === 'close') {
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      inst.status = loggedOut ? 'logged_out' : 'closed';
      dispatch(name, 'connection.update', { state: 'close', statusCode });
      if (!loggedOut && instances.has(name)) {
        logger.warn({ instance: name, statusCode }, 'Conexão fechada, reconectando');
        setTimeout(() => startBaileys(name).catch((e) => logger.error(e.message)), 3000);
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (!msg.message) continue;
      const data = await normalizeMessage(name, sock, msg);
      dispatch(name, 'messages.upsert', data);
    }
  });

  sock.ev.on('messages.update', (updates) => dispatch(name, 'messages.update', updates));
  sock.ev.on('presence.update', (data) => dispatch(name, 'presence.update', data));

  return inst;
}

// ── API pública do gerenciador ──────────────────────────────

export async function createInstance({ instanceName, integration = 'BAILEYS', phoneNumberId, token }) {
  if (instances.has(instanceName)) throw new Error(`Instância "${instanceName}" já existe`);

  store.setSection(instanceName, '_instance', {
    integration,
    createdAt: new Date().toISOString(),
    ...(integration === 'CLOUDAPI' && { phoneNumberId }),
  });

  if (integration === 'CLOUDAPI') {
    instances.set(instanceName, {
      integration: 'CLOUDAPI',
      status: 'open',
      cloudapi: { phoneNumberId, token },
    });
    return getStatus(instanceName);
  }

  await startBaileys(instanceName);
  return getStatus(instanceName);
}

export function getInstance(name) {
  const inst = instances.get(name);
  if (!inst) throw new Error(`Instância "${name}" não encontrada`);
  return inst;
}

export function getStatus(name) {
  const inst = getInstance(name);
  return { instance: name, integration: inst.integration, status: inst.status, qrcode: inst.qrCode || null };
}

export function listAll() {
  return [...instances.entries()].map(([name, i]) => ({
    instance: name,
    integration: i.integration,
    status: i.status,
  }));
}

export async function logout(name) {
  const inst = getInstance(name);
  if (inst.sock) await inst.sock.logout().catch(() => {});
  inst.status = 'logged_out';
  return getStatus(name);
}

export async function remove(name) {
  const inst = instances.get(name);
  if (inst?.sock) {
    await inst.sock.logout().catch(() => {});
    inst.sock.end?.();
  }
  instances.delete(name);
  store.deleteInstance(name);
  fs.rmSync(path.join(AUTH_DIR, name), { recursive: true, force: true });
}

export async function restart(name) {
  const inst = getInstance(name);
  if (inst.integration === 'BAILEYS') {
    inst.sock?.end?.();
    await startBaileys(name);
  }
  return getStatus(name);
}

// ── Envio de mensagens (roteia entre Baileys e Cloud API) ──

export async function sendText(name, number, text, options = {}) {
  const inst = getInstance(name);
  if (inst.integration === 'CLOUDAPI') return cloudapi.sendText(inst.cloudapi, number, text);
  if (options.delay) await new Promise((r) => setTimeout(r, options.delay));
  const sent = await inst.sock.sendMessage(toJid(number), { text });
  dispatch(name, 'send.message', { number, text, id: sent?.key?.id });
  return sent;
}

export async function sendMedia(name, number, { mediaUrl, mediatype = 'image', caption, fileName, mimetype }) {
  const inst = getInstance(name);
  if (inst.integration === 'CLOUDAPI')
    return cloudapi.sendMedia(inst.cloudapi, number, { mediaUrl, mediatype, caption, fileName });

  const content =
    mediatype === 'video'
      ? { video: { url: mediaUrl }, caption }
      : mediatype === 'document'
        ? { document: { url: mediaUrl }, fileName: fileName || 'file', mimetype: mimetype || 'application/pdf' }
        : mediatype === 'sticker'
          ? { sticker: { url: mediaUrl } }
          : { image: { url: mediaUrl }, caption };

  return inst.sock.sendMessage(toJid(number), content);
}

export async function sendAudio(name, number, audioUrl, ptt = true) {
  const inst = getInstance(name);
  if (inst.integration === 'CLOUDAPI') return cloudapi.sendAudio(inst.cloudapi, number, audioUrl);
  return inst.sock.sendMessage(toJid(number), {
    audio: { url: audioUrl },
    ptt,
    mimetype: 'audio/ogg; codecs=opus',
  });
}

export async function sendLocation(name, number, { latitude, longitude, name: locName, address }) {
  const inst = getInstance(name);
  if (inst.integration === 'CLOUDAPI')
    return cloudapi.sendLocation(inst.cloudapi, number, { latitude, longitude, name: locName, address });
  return inst.sock.sendMessage(toJid(number), {
    location: { degreesLatitude: Number(latitude), degreesLongitude: Number(longitude), name: locName, address },
  });
}

export async function sendReaction(name, number, messageId, emoji) {
  const inst = getInstance(name);
  return inst.sock.sendMessage(toJid(number), {
    react: { text: emoji, key: { remoteJid: toJid(number), id: messageId, fromMe: false } },
  });
}

// Localiza instância CLOUDAPI pelo phoneNumberId (para webhooks da Meta)
export function findByPhoneNumberId(phoneNumberId) {
  for (const [name, inst] of instances) {
    if (inst.integration === 'CLOUDAPI' && inst.cloudapi?.phoneNumberId === phoneNumberId) return name;
  }
  return null;
}

// Restaura instâncias persistidas ao iniciar o servidor
export async function init() {
  registerSender({ sendText, sendMedia, sendAudio });
  for (const meta of store.listInstances()) {
    try {
      if (meta.integration === 'CLOUDAPI') {
        instances.set(meta.name, {
          integration: 'CLOUDAPI',
          status: 'open',
          cloudapi: { phoneNumberId: meta.phoneNumberId, token: undefined },
        });
      } else if (fs.existsSync(path.join(AUTH_DIR, meta.name))) {
        await startBaileys(meta.name);
      }
      logger.info({ instance: meta.name }, 'Instância restaurada');
    } catch (err) {
      logger.error({ instance: meta.name, err: err.message }, 'Falha ao restaurar instância');
    }
  }
}
