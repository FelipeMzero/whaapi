import { Router } from 'express';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { dispatch } from '../../events/dispatcher.js';
import * as cloudapi from '../../whatsapp/cloudapi.service.js';
import * as manager from '../../whatsapp/instance.manager.js';

const router = Router();

// GET /cloudapi/webhook — verificação do webhook exigida pela Meta
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === env.cloudapi.verifyToken) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// POST /cloudapi/webhook — eventos da WhatsApp Business Cloud API (Meta)
router.post('/webhook', (req, res) => {
  res.sendStatus(200); // a Meta exige resposta imediata
  const events = cloudapi.parseWebhook(req.body);
  for (const ev of events) {
    const instance = manager.findByPhoneNumberId(ev.phoneNumberId);
    if (!instance) {
      logger.warn({ phoneNumberId: ev.phoneNumberId }, 'Webhook Cloud API sem instância correspondente');
      continue;
    }
    if (ev.message) dispatch(instance, 'messages.upsert', ev.message);
    if (ev.status) dispatch(instance, 'messages.update', ev.status);
  }
});

export default router;
