import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const OPENAI_URL = 'https://api.openai.com/v1';

// Histórico de conversa por "instancia:numero" (janela das últimas 20 mensagens)
const history = new Map();

function apiKeyFor(cfg) {
  return cfg?.apiKey || env.openai.apiKey;
}

// Converte áudio em texto (Whisper). Usado automaticamente em áudios recebidos.
export async function transcribe(buffer, mimetype = 'audio/ogg', cfg = null) {
  const apiKey = apiKeyFor(cfg);
  if (!apiKey) return null;
  try {
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: mimetype }), 'audio.ogg');
    form.append('model', cfg?.transcriptionModel || 'whisper-1');
    const res = await fetch(`${OPENAI_URL}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.text || null;
  } catch (err) {
    logger.error({ err: err.message }, 'Falha na transcrição de áudio (OpenAI)');
    return null;
  }
}

// cfg: { enabled, apiKey?, model, systemPrompt, speechToText }
// Chatbot de IA: responde mensagens recebidas usando Chat Completions
export async function onMessage(instance, cfg, msg, sender) {
  if (!cfg?.enabled || !sender) return;
  const apiKey = apiKeyFor(cfg);
  const text = msg.text || msg.transcription;
  if (!apiKey || !text) return;

  const key = `${instance}:${msg.number}`;
  const messages = history.get(key) || [];
  messages.push({ role: 'user', content: text });

  try {
    const res = await fetch(`${OPENAI_URL}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: cfg.model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: cfg.systemPrompt || 'Você é um assistente prestativo.' },
          ...messages.slice(-20),
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const answer = data.choices?.[0]?.message?.content;
    if (answer) {
      messages.push({ role: 'assistant', content: answer });
      history.set(key, messages.slice(-20));
      await sender.sendText(instance, msg.number, answer);
    }
  } catch (err) {
    logger.error({ err: err.message }, 'Falha no chatbot OpenAI');
  }
}
