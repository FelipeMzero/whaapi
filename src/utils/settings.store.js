import fs from 'node:fs';
import path from 'node:path';

// Persistência simples em JSON (sem banco de dados).
// Estrutura: { [instanceName]: { _instance, webhook, typebot, chatwoot, dify, openai } }
const STORE_DIR = path.resolve('store');
const FILE = path.join(STORE_DIR, 'settings.json');

let cache = null;

function load() {
  if (cache === null) {
    try {
      cache = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    } catch {
      cache = {};
    }
  }
  return cache;
}

function persist() {
  fs.mkdirSync(STORE_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(cache, null, 2));
}

export function getSettings(instance) {
  return load()[instance] || {};
}

export function getSection(instance, section) {
  return getSettings(instance)[section] || null;
}

export function setSection(instance, section, data) {
  const all = load();
  all[instance] = all[instance] || {};
  all[instance][section] = data;
  persist();
  return all[instance][section];
}

export function deleteInstance(instance) {
  const all = load();
  delete all[instance];
  persist();
}

export function listInstances() {
  return Object.keys(load()).map((name) => ({
    name,
    ...((load()[name] || {})._instance || {}),
  }));
}
