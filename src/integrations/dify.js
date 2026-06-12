import axios from 'axios';
import { logger } from '../utils/logger.js';

// Conversas do Dify por "instancia:numero" -> conversation_id
const conversations = new Map();

// cfg: { enabled, url, apiKey }  (url ex: https://api.dify.ai/v1)
// Encaminha a mensagem para um fluxo de agente de IA do Dify e responde no WhatsApp
export async function onMessage(instance, cfg, msg, sender) {
  if (!cfg?.enabled || !cfg.url || !cfg.apiKey || !sender) return;
  if (!msg.text) return;

  const key = `${instance}:${msg.number}`;
  try {
    const res = await axios.post(
      `${cfg.url.replace(/\/$/, '')}/chat-messages`,
      {
        inputs: {},
        query: msg.text,
        response_mode: 'blocking',
        conversation_id: conversations.get(key) || '',
        user: `${instance}-${msg.number}`,
      },
      {
        headers: { Authorization: `Bearer ${cfg.apiKey}` },
        timeout: 60000,
      }
    );

    if (res.data?.conversation_id) conversations.set(key, res.data.conversation_id);
    if (res.data?.answer) await sender.sendText(instance, msg.number, res.data.answer);
  } catch (err) {
    logger.error({ err: err.response?.data || err.message }, 'Falha na integração com Dify');
  }
}
