import axios from 'axios';
import { logger } from '../utils/logger.js';

// cfg por instância: { enabled, url, events: ["messages.upsert", ...] | [] (todos), headers: {} }
export async function publish(cfg, event, payload) {
  if (!cfg?.enabled || !cfg.url) return;
  if (Array.isArray(cfg.events) && cfg.events.length > 0 && !cfg.events.includes(event)) return;
  try {
    await axios.post(cfg.url, payload, {
      timeout: 15000,
      headers: { 'Content-Type': 'application/json', ...(cfg.headers || {}) },
    });
  } catch (err) {
    logger.error({ url: cfg.url, err: err.message }, 'Falha ao entregar webhook');
  }
}
