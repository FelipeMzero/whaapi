<div align="center">

# 📱 WhaAPI

**API REST open-source para WhatsApp e WhatsApp Business — HTTP & HTTPS**

Conecte via WhatsApp Web (Baileys) ou pela Cloud API oficial da Meta, e integre com Typebot, Chatwoot, RabbitMQ, Kafka, SQS, Socket.io, Dify, OpenAI e S3/MinIO.

</div>

---

## ✨ Recursos

| Integração | Função |
|---|---|
| **Typebot** | Bots conversacionais com gerenciamento de gatilhos (palavra-chave, regex ou todas as mensagens) |
| **Chatwoot** | Plataforma de atendimento ao cliente — mensagens entram como conversas e respostas dos agentes voltam ao WhatsApp |
| **RabbitMQ** | Transmissão de eventos via AMQP (exchange topic, routing key `instancia.evento`) |
| **Apache Kafka** | Streaming e processamento de eventos em tempo real |
| **Amazon SQS** | Filas de mensagens na nuvem (suporta filas FIFO) |
| **Socket.io** | Eventos WebSocket em tempo real, com salas por instância |
| **Dify** | Fluxos de trabalho de agentes de IA respondendo automaticamente |
| **OpenAI** | Chatbot GPT e conversão de áudio em texto (Whisper) |
| **S3 / MinIO** | Armazenamento automático de arquivos de mídia recebidos |
| **Webhooks** | Entrega de eventos via HTTP com filtro por tipo de evento |

Dois modos de conexão por instância:

- **`BAILEYS`** — WhatsApp Web via QR Code (não-oficial, multi-dispositivo)
- **`CLOUDAPI`** — WhatsApp Business Cloud API oficial da Meta (Graph API)

---

## 🚀 Instalação

### Via Docker (recomendado)

```bash
git clone https://github.com/FelipeMzero/whaapi.git
cd whaapi
cp .env.example .env   # edite a API_KEY e as integrações desejadas
docker compose up -d --build
```

Serviços opcionais via perfis do Compose:

```bash
docker compose --profile rabbitmq --profile minio up -d   # com RabbitMQ + MinIO
docker compose --profile kafka up -d                       # com Kafka
```

### Via Node.js (NVM)

Requer **Node.js >= 20**.

```bash
nvm install 20 && nvm use 20
git clone https://github.com/FelipeMzero/whaapi.git
cd whaapi
cp .env.example .env
npm install
npm start          # produção
npm run dev        # desenvolvimento (auto-reload)
```

### HTTPS

Informe o certificado no `.env` e a API sobe simultaneamente em HTTP e HTTPS:

```env
SSL_CERT=/caminho/fullchain.pem
SSL_KEY=/caminho/privkey.pem
HTTPS_PORT=8443
```

---

## 🔑 Autenticação

Todas as rotas (exceto `/health`, `/cloudapi/webhook` e `/chatwoot/webhook/*`) exigem o header:

```
apikey: SUA_API_KEY
```

---

## 📖 Endpoints principais

### Instâncias

```http
POST   /instance/create            { "instanceName": "minha", "integration": "BAILEYS" }
GET    /instance                   # lista instâncias
GET    /instance/connect/minha     # retorna QR Code em base64
GET    /instance/status/minha
POST   /instance/restart/minha
POST   /instance/logout/minha
DELETE /instance/minha
```

Para WhatsApp Business oficial:

```json
POST /instance/create
{ "instanceName": "oficial", "integration": "CLOUDAPI", "phoneNumberId": "1234567890", "token": "EAAB..." }
```

### Mensagens

```http
POST /message/sendText/minha       { "number": "5593999999999", "text": "Olá!" }
POST /message/sendMedia/minha      { "number": "...", "mediaUrl": "https://...", "mediatype": "image", "caption": "Legenda" }
POST /message/sendAudio/minha      { "number": "...", "audioUrl": "https://...", "ptt": true }
POST /message/sendLocation/minha   { "number": "...", "latitude": -2.42, "longitude": -54.74, "name": "Santarém" }
POST /message/sendReaction/minha   { "number": "...", "messageId": "ABC123", "emoji": "👍" }
```

### Integrações (padrão `set` / `find` por instância)

```http
POST /webhook/set/minha    { "enabled": true, "url": "https://meusite.com/hook", "events": ["messages.upsert"] }
POST /typebot/set/minha    { "enabled": true, "url": "https://typebot.io", "typebot": "meu-bot", "triggerType": "keyword", "triggerValue": "oi", "expireMinutes": 30 }
POST /chatwoot/set/minha   { "enabled": true, "url": "https://chatwoot.com", "accountId": 1, "token": "...", "inboxId": 2, "signMsg": true }
POST /dify/set/minha       { "enabled": true, "url": "https://api.dify.ai/v1", "apiKey": "app-..." }
POST /openai/set/minha     { "enabled": true, "model": "gpt-4o-mini", "systemPrompt": "Você é um atendente.", "speechToText": true }
GET  /webhook/find/minha   # idem para typebot, chatwoot, dify, openai
```

### Webhooks de entrada

| URL | Quem chama |
|---|---|
| `GET/POST /cloudapi/webhook` | Meta (verificação + eventos da Cloud API) |
| `POST /chatwoot/webhook/:instance` | Chatwoot (respostas de agentes → WhatsApp) |

---

## 📡 Eventos

Todos os eventos são distribuídos simultaneamente para **webhook, Socket.io, RabbitMQ, Kafka e SQS**:

| Evento | Descrição |
|---|---|
| `qrcode.updated` | Novo QR Code gerado |
| `connection.update` | Estado da conexão mudou |
| `messages.upsert` | Mensagem recebida (com `mediaUrl` do S3 e `transcription` do Whisper, quando habilitados) |
| `messages.update` | Status de mensagem (entregue, lida...) |
| `send.message` | Mensagem enviada pela API |
| `presence.update` | Presença (digitando, online...) |

Exemplo de consumo via Socket.io:

```js
import { io } from "socket.io-client";
const socket = io("http://localhost:8080", { query: { instance: "minha" } });
socket.on("messages.upsert", (payload) => console.log(payload));
```

Formato do payload:

```json
{
  "event": "messages.upsert",
  "instance": "minha",
  "data": { "number": "5593...", "text": "Olá", "messageType": "conversation", "fromMe": false },
  "date": "2026-06-12T12:00:00.000Z",
  "apiName": "WhaAPI"
}
```

---

## ⚙️ Variáveis de ambiente

Veja o arquivo [`.env.example`](.env.example) — inclui servidor (portas HTTP/HTTPS, SSL), `API_KEY`, RabbitMQ, Kafka, SQS, S3/MinIO, OpenAI e Cloud API da Meta.

---

## 🗂 Estrutura do projeto

```
src/
├── server.js                  # Express + HTTP/HTTPS + Socket.io
├── config/env.js              # Variáveis de ambiente
├── api/
│   ├── middlewares/auth.js    # Autenticação por apikey
│   └── routes/                # instance, message, integrações, cloudapi
├── whatsapp/
│   ├── instance.manager.js    # Instâncias Baileys + roteamento de envio
│   └── cloudapi.service.js    # WhatsApp Business Cloud API (Meta)
├── events/dispatcher.js       # Distribui eventos para todas as integrações
├── integrations/              # typebot, chatwoot, dify, openai, rabbitmq,
│                              # kafka, sqs, socketio, s3, webhook
└── utils/                     # logger, settings.store
site/                          # Landing page (HTML/CSS/JS)
```

---

## ⚠️ Aviso legal

O modo `BAILEYS` usa engenharia reversa do WhatsApp Web e **não é afiliado nem endossado pela Meta**; seu uso pode violar os Termos de Serviço do WhatsApp e resultar em banimento do número. Para uso comercial em produção, prefira o modo `CLOUDAPI` (oficial). Use por sua conta e risco.

## 📄 Licença

[MIT](LICENSE)
