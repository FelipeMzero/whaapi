import { Router } from 'express';
import * as manager from '../../whatsapp/instance.manager.js';

const router = Router();

function required(res, body, fields) {
  for (const f of fields) {
    if (body[f] === undefined || body[f] === null || body[f] === '') {
      res.status(400).json({ error: `Campo obrigatório: ${f}` });
      return false;
    }
  }
  return true;
}

// POST /message/sendText/:instance { number, text, delay? }
router.post('/sendText/:instance', async (req, res, next) => {
  try {
    if (!required(res, req.body, ['number', 'text'])) return;
    const { number, text, delay } = req.body;
    const sent = await manager.sendText(req.params.instance, number, text, { delay });
    res.status(201).json({ status: 'sent', id: sent?.key?.id || sent?.messages?.[0]?.id || null });
  } catch (err) {
    next(err);
  }
});

// POST /message/sendMedia/:instance { number, mediaUrl, mediatype: image|video|document|sticker, caption?, fileName?, mimetype? }
router.post('/sendMedia/:instance', async (req, res, next) => {
  try {
    if (!required(res, req.body, ['number', 'mediaUrl'])) return;
    const sent = await manager.sendMedia(req.params.instance, req.body.number, req.body);
    res.status(201).json({ status: 'sent', id: sent?.key?.id || sent?.messages?.[0]?.id || null });
  } catch (err) {
    next(err);
  }
});

// POST /message/sendAudio/:instance { number, audioUrl, ptt? }
router.post('/sendAudio/:instance', async (req, res, next) => {
  try {
    if (!required(res, req.body, ['number', 'audioUrl'])) return;
    const { number, audioUrl, ptt = true } = req.body;
    const sent = await manager.sendAudio(req.params.instance, number, audioUrl, ptt);
    res.status(201).json({ status: 'sent', id: sent?.key?.id || sent?.messages?.[0]?.id || null });
  } catch (err) {
    next(err);
  }
});

// POST /message/sendLocation/:instance { number, latitude, longitude, name?, address? }
router.post('/sendLocation/:instance', async (req, res, next) => {
  try {
    if (!required(res, req.body, ['number', 'latitude', 'longitude'])) return;
    const sent = await manager.sendLocation(req.params.instance, req.body.number, req.body);
    res.status(201).json({ status: 'sent', id: sent?.key?.id || null });
  } catch (err) {
    next(err);
  }
});

// POST /message/sendReaction/:instance { number, messageId, emoji }
router.post('/sendReaction/:instance', async (req, res, next) => {
  try {
    if (!required(res, req.body, ['number', 'messageId', 'emoji'])) return;
    const { number, messageId, emoji } = req.body;
    const sent = await manager.sendReaction(req.params.instance, number, messageId, emoji);
    res.status(201).json({ status: 'sent', id: sent?.key?.id || null });
  } catch (err) {
    next(err);
  }
});

export default router;
