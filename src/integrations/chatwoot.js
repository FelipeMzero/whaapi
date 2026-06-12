import axios from 'axios';
import { logger } from '../utils/logger.js';

// Cache de conversas: "instancia:numero" -> conversationId
const conversations = new Map();

function api(cfg) {
  return axios.create({
    baseURL: `${cfg.url.replace(/\/$/, '')}/api/v1/accounts/${cfg.accountId}`,
    headers: { api_access_token: cfg.token },
    timeout: 15000,
  });
}

async function findOrCreateContact(client, cfg, msg) {
  const search = await client.get('/contacts/search', { params: { q: msg.number } });
  const existing = search.data?.payload?.[0];
  if (existing) return existing;

  const created = await client.post('/contacts', {
    inbox_id: cfg.inboxId,
    name: msg.pushName || msg.number,
    phone_number: `+${msg.number}`,
    identifier: msg.number,
  });
  return created.data?.payload?.contact || created.data?.payload || created.data;
}

async function findOrCreateConversation(client, cfg, contact, key) {
  if (conversations.has(key)) return conversations.get(key);

  const list = await client.get(`/contacts/${contact.id}/conversations`);
  const open = (list.data?.payload || []).find(
    (c) => c.inbox_id === Number(cfg.inboxId) && c.status !== 'resolved'
  );
  if (open) {
    conversations.set(key, open.id);
    return open.id;
  }

  const created = await client.post('/conversations', {
    contact_id: contact.id,
    inbox_id: cfg.inboxId,
  });
  conversations.set(key, created.data.id);
  return created.data.id;
}

// cfg: { enabled, url, accountId, token, inboxId, signMsg }
// Envia mensagens recebidas no WhatsApp para o Chatwoot como "incoming"
export async function onMessage(instance, cfg, msg) {
  if (!cfg?.enabled || !cfg.url || !cfg.token || !cfg.accountId || !cfg.inboxId) return;
  try {
    const client = api(cfg);
    const contact = await findOrCreateContact(client, cfg, msg);
    const conversationId = await findOrCreateConversation(
      client,
      cfg,
      contact,
      `${instance}:${msg.number}`
    );

    const content = msg.text || `[${msg.messageType}]${msg.mediaUrl ? ` ${msg.mediaUrl}` : ''}`;
    await client.post(`/conversations/${conversationId}/messages`, {
      content,
      message_type: 'incoming',
      private: false,
    });
  } catch (err) {
    logger.error({ err: err.response?.data || err.message }, 'Falha na integração com Chatwoot');
  }
}

// Webhook do Chatwoot -> responde no WhatsApp quando um agente envia mensagem "outgoing"
export async function onChatwootWebhook(instance, cfg, body, sender) {
  if (!cfg?.enabled || !sender) return;
  if (body.message_type !== 'outgoing' || body.private) return;
  const phone = body.conversation?.meta?.sender?.phone_number?.replace(/\D/g, '');
  if (!phone || !body.content) return;
  const text = cfg.signMsg && body.sender?.name ? `*${body.sender.name}:*\n${body.content}` : body.content;
  await sender.sendText(instance, phone, text);
}
