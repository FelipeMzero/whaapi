import { Router } from 'express';
import * as store from '../../utils/settings.store.js';
import * as chatwoot from '../../integrations/chatwoot.js';
import * as typebot from '../../integrations/typebot.js';
import { getSender } from '../../events/dispatcher.js';

const router = Router();

// Seções de configuração aceitas por instância
const SECTIONS = ['webhook', 'typebot', 'chatwoot', 'dify', 'openai'];

// POST /:section/set/:instance — salva configuração da integração
// Exemplos de corpo:
//  webhook:  { enabled, url, events: [], headers: {} }
//  typebot:  { enabled, url, typebot, triggerType: all|keyword, triggerOperator, triggerValue, expireMinutes }
//  chatwoot: { enabled, url, accountId, token, inboxId, signMsg }
//  dify:     { enabled, url, apiKey }
//  openai:   { enabled, apiKey?, model, systemPrompt, speechToText }
router.post('/:section/set/:instance', (req, res) => {
  const { section, instance } = req.params;
  if (!SECTIONS.includes(section)) return res.status(404).json({ error: `Integração desconhecida: ${section}` });
  const saved = store.setSection(instance, section, req.body);
  res.status(201).json({ instance, [section]: saved });
});

// GET /:section/find/:instance — consulta configuração da integração
router.get('/:section/find/:instance', (req, res) => {
  const { section, instance } = req.params;
  if (!SECTIONS.includes(section)) return res.status(404).json({ error: `Integração desconhecida: ${section}` });
  res.json({ instance, [section]: store.getSection(instance, section) });
});

// DELETE /typebot/session/:instance/:number — reinicia sessão do Typebot para um contato
router.delete('/typebot/session/:instance/:number', (req, res) => {
  typebot.clearSession(req.params.instance, req.params.number);
  res.json({ cleared: true });
});

// POST /chatwoot/webhook/:instance — receptor de webhooks do Chatwoot
// (configure esta URL no inbox do Chatwoot para respostas dos agentes chegarem no WhatsApp)
router.post('/chatwoot/webhook/:instance', async (req, res) => {
  const instance = req.params.instance;
  const cfg = store.getSection(instance, 'chatwoot');
  await chatwoot.onChatwootWebhook(instance, cfg, req.body, getSender());
  res.json({ received: true });
});

export default router;
