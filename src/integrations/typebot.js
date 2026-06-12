import axios from 'axios';
import { logger } from '../utils/logger.js';

// Sessões ativas do Typebot por "instancia:numero"
const sessions = new Map();

// Extrai texto puro dos blocos richText retornados pelo Typebot
function richTextToPlain(richText) {
  if (!Array.isArray(richText)) return '';
  const walk = (nodes) =>
    nodes
      .map((n) => {
        if (typeof n.text === 'string') return n.text;
        if (Array.isArray(n.children)) return walk(n.children);
        return '';
      })
      .join('');
  return richText.map((block) => walk(block.children || [])).join('\n');
}

function extractMessages(typebotMessages = []) {
  const out = [];
  for (const m of typebotMessages) {
    if (m.type === 'text') out.push({ text: richTextToPlain(m.content?.richText) });
    else if (m.type === 'image') out.push({ mediaUrl: m.content?.url, mediatype: 'image' });
    else if (m.type === 'video') out.push({ mediaUrl: m.content?.url, mediatype: 'video' });
    else if (m.type === 'audio') out.push({ audioUrl: m.content?.url });
  }
  return out;
}

function matchesTrigger(cfg, text) {
  const type = cfg.triggerType || 'all';
  if (type === 'all') return true;
  if (type === 'keyword') {
    const value = String(cfg.triggerValue || '').toLowerCase();
    const operator = cfg.triggerOperator || 'contains';
    const t = String(text || '').toLowerCase();
    if (operator === 'equals') return t === value;
    if (operator === 'startsWith') return t.startsWith(value);
    if (operator === 'regex') return new RegExp(cfg.triggerValue, 'i').test(text || '');
    return t.includes(value);
  }
  return false;
}

// cfg: { enabled, url, typebot, triggerType: all|keyword, triggerOperator, triggerValue, expireMinutes }
export async function onMessage(instance, cfg, msg, sender) {
  if (!cfg?.enabled || !cfg.url || !cfg.typebot || !sender) return;
  if (!msg.text) return;

  const sessionKey = `${instance}:${msg.number}`;
  let session = sessions.get(sessionKey);

  if (session && cfg.expireMinutes && Date.now() - session.startedAt > cfg.expireMinutes * 60000) {
    sessions.delete(sessionKey);
    session = null;
  }

  if (!session && !matchesTrigger(cfg, msg.text)) return;

  try {
    let data;
    const base = cfg.url.replace(/\/$/, '');
    if (!session) {
      const res = await axios.post(`${base}/api/v1/typebots/${cfg.typebot}/startChat`, {
        message: msg.text,
        prefilledVariables: {
          number: msg.number,
          pushName: msg.pushName || '',
          instance,
        },
      });
      data = res.data;
      if (data.sessionId) {
        sessions.set(sessionKey, { sessionId: data.sessionId, startedAt: Date.now() });
      }
    } else {
      const res = await axios.post(`${base}/api/v1/sessions/${session.sessionId}/continueChat`, {
        message: msg.text,
      });
      data = res.data;
    }

    for (const reply of extractMessages(data?.messages)) {
      if (reply.text) await sender.sendText(instance, msg.number, reply.text);
      else if (reply.mediaUrl)
        await sender.sendMedia(instance, msg.number, {
          mediaUrl: reply.mediaUrl,
          mediatype: reply.mediatype,
        });
      else if (reply.audioUrl) await sender.sendAudio(instance, msg.number, reply.audioUrl);
    }

    // Sem input esperado = fim do fluxo, encerra a sessão
    if (data && !data.input) sessions.delete(sessionKey);
  } catch (err) {
    logger.error({ err: err.message }, 'Falha na integração com Typebot');
    sessions.delete(sessionKey);
  }
}

export function clearSession(instance, number) {
  sessions.delete(`${instance}:${number}`);
}
