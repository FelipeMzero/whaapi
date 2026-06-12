import { env } from '../../config/env.js';

// Autenticação global via header "apikey" (mesmo padrão da Evolution API)
export function apiKeyAuth(req, res, next) {
  const key = req.headers.apikey || req.query.apikey;
  if (key !== env.auth.apiKey) {
    return res.status(401).json({ status: 401, error: 'Unauthorized', message: 'apikey inválida ou ausente' });
  }
  next();
}
