// ── Cards de integrações ──
const FEATURES = [
  { icon: '🤖', name: 'Typebot', desc: 'Bots conversacionais com gerenciamento de gatilhos por palavra-chave, regex ou todas as mensagens.' },
  { icon: '💬', name: 'Chatwoot', desc: 'Plataforma de atendimento — conversas sincronizadas nos dois sentidos com seus agentes.' },
  { icon: '🐰', name: 'RabbitMQ', desc: 'Transmissão de eventos via AMQP com exchange topic e routing key por instância.' },
  { icon: '⚡', name: 'Apache Kafka', desc: 'Streaming e processamento de eventos em tempo real para pipelines de dados.' },
  { icon: '📨', name: 'Amazon SQS', desc: 'Filas de mensagens na nuvem, com suporte a filas FIFO.' },
  { icon: '🔌', name: 'Socket.io', desc: 'Eventos WebSocket em tempo real com salas por instância.' },
  { icon: '🧠', name: 'Dify', desc: 'Fluxos de trabalho de agentes de IA respondendo conversas automaticamente.' },
  { icon: '✨', name: 'OpenAI', desc: 'Chatbot GPT e conversão de áudio em texto com Whisper.' },
  { icon: '🗄️', name: 'S3 / MinIO', desc: 'Upload automático de mídias recebidas para armazenamento de objetos.' },
];

const grid = document.getElementById('features-grid');
if (grid) {
  grid.innerHTML = FEATURES.map(
    (f) => `<div class="card"><div class="icon">${f.icon}</div><h3>${f.name}</h3><p>${f.desc}</p></div>`
  ).join('');
}

// ── Lista de endpoints ──
const ENDPOINTS = [
  ['POST', '/instance/create', 'Cria instância (BAILEYS ou CLOUDAPI)'],
  ['GET', '/instance/connect/:name', 'QR Code em base64 para pareamento'],
  ['GET', '/instance', 'Lista todas as instâncias'],
  ['DELETE', '/instance/:name', 'Remove instância e credenciais'],
  ['POST', '/message/sendText/:instance', 'Envia mensagem de texto'],
  ['POST', '/message/sendMedia/:instance', 'Envia imagem, vídeo, documento ou sticker'],
  ['POST', '/message/sendAudio/:instance', 'Envia áudio (PTT)'],
  ['POST', '/message/sendLocation/:instance', 'Envia localização'],
  ['POST', '/webhook/set/:instance', 'Configura webhook de eventos'],
  ['POST', '/typebot/set/:instance', 'Configura bot do Typebot com gatilhos'],
  ['POST', '/chatwoot/set/:instance', 'Configura integração com Chatwoot'],
  ['POST', '/dify/set/:instance', 'Configura agente de IA do Dify'],
  ['POST', '/openai/set/:instance', 'Configura chatbot GPT e transcrição'],
  ['GET', '/health', 'Status do servidor'],
];

const list = document.getElementById('endpoints-list');
if (list) {
  list.innerHTML = ENDPOINTS.map(
    ([method, path, desc]) =>
      `<div class="endpoint"><span class="method ${method.toLowerCase()}">${method}</span><span class="path">${path}</span><span class="desc">${desc}</span></div>`
  ).join('');
}

// ── Abas de instalação ──
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});
