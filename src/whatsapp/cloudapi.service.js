import axios from 'axios';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

// Serviço da WhatsApp Business Cloud API (oficial Meta / Graph API)
// cfg por instância: { phoneNumberId, token }

const GRAPH = () => `https://graph.facebook.com/${env.cloudapi.version}`;

function client(cfg) {
  return axios.create({
    baseURL: `${GRAPH()}/${cfg.phoneNumberId}`,
    headers: { Authorization: `Bearer ${cfg.token || env.cloudapi.token}` },
    timeout: 30000,
  });
}

export async function sendText(cfg, number, text) {
  const res = await client(cfg).post('/messages', {
    messaging_product: 'whatsapp',
    to: number,
    type: 'text',
    text: { body: text },
  });
  return res.data;
}

export async function sendMedia(cfg, number, { mediaUrl, mediatype = 'image', caption, fileName }) {
  const body = {
    messaging_product: 'whatsapp',
    to: number,
    type: mediatype,
    [mediatype]: { link: mediaUrl, ...(caption && { caption }), ...(fileName && { filename: fileName }) },
  };
  const res = await client(cfg).post('/messages', body);
  return res.data;
}

export async function sendAudio(cfg, number, audioUrl) {
  const res = await client(cfg).post('/messages', {
    messaging_product: 'whatsapp',
    to: number,
    type: 'audio',
    audio: { link: audioUrl },
  });
  return res.data;
}

export async function sendLocation(cfg, number, { latitude, longitude, name, address }) {
  const res = await client(cfg).post('/messages', {
    messaging_product: 'whatsapp',
    to: number,
    type: 'location',
    location: { latitude, longitude, name, address },
  });
  return res.data;
}

// Converte o payload de webhook da Meta em mensagens normalizadas da WhaAPI
export function parseWebhook(body) {
  const events = [];
  try {
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        const phoneNumberId = value.metadata?.phone_number_id;
        for (const m of value.messages || []) {
          const contact = (value.contacts || [])[0];
          events.push({
            phoneNumberId,
            message: {
              key: { id: m.id, remoteJid: `${m.from}@s.whatsapp.net`, fromMe: false },
              number: m.from,
              remoteJid: `${m.from}@s.whatsapp.net`,
              fromMe: false,
              pushName: contact?.profile?.name || '',
              messageType: m.type,
              text: m.text?.body || m.button?.text || m.interactive?.button_reply?.title || '',
              timestamp: Number(m.timestamp),
              source: 'CLOUDAPI',
              raw: m,
            },
          });
        }
        for (const s of value.statuses || []) {
          events.push({
            phoneNumberId,
            status: { id: s.id, status: s.status, recipient: s.recipient_id, timestamp: Number(s.timestamp) },
          });
        }
      }
    }
  } catch (err) {
    logger.error({ err: err.message }, 'Falha ao interpretar webhook da Cloud API');
  }
  return events;
}
