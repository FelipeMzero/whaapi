import { Router } from 'express';
import * as manager from '../../whatsapp/instance.manager.js';

const router = Router();

// POST /instance/create { instanceName, integration: "BAILEYS" | "CLOUDAPI", phoneNumberId?, token? }
router.post('/create', async (req, res, next) => {
  try {
    const { instanceName, integration, phoneNumberId, token } = req.body;
    if (!instanceName) return res.status(400).json({ error: 'instanceName é obrigatório' });
    if (integration === 'CLOUDAPI' && !phoneNumberId)
      return res.status(400).json({ error: 'phoneNumberId é obrigatório para CLOUDAPI' });
    const result = await manager.createInstance({ instanceName, integration, phoneNumberId, token });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /instance — lista todas as instâncias
router.get('/', (req, res) => res.json(manager.listAll()));

// GET /instance/connect/:name — retorna QR Code (base64) para pareamento
router.get('/connect/:name', (req, res, next) => {
  try {
    res.json(manager.getStatus(req.params.name));
  } catch (err) {
    next(err);
  }
});

// GET /instance/status/:name
router.get('/status/:name', (req, res, next) => {
  try {
    res.json(manager.getStatus(req.params.name));
  } catch (err) {
    next(err);
  }
});

// POST /instance/restart/:name
router.post('/restart/:name', async (req, res, next) => {
  try {
    res.json(await manager.restart(req.params.name));
  } catch (err) {
    next(err);
  }
});

// POST /instance/logout/:name
router.post('/logout/:name', async (req, res, next) => {
  try {
    res.json(await manager.logout(req.params.name));
  } catch (err) {
    next(err);
  }
});

// DELETE /instance/:name — remove instância e credenciais
router.delete('/:name', async (req, res, next) => {
  try {
    await manager.remove(req.params.name);
    res.json({ deleted: true, instance: req.params.name });
  } catch (err) {
    next(err);
  }
});

export default router;
