/*
  Тонкая обёртка над GitHub Contents API.
  Всё выполняется прямо из браузера: токен хранится только
  в localStorage этого браузера и используется исключительно
  для запросов к api.github.com.
*/

const GH_STORAGE_KEY = 'webcomic_gh_settings_v1';

function ghLoadSettings() {
  try {
    const raw = localStorage.getItem(GH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : { owner: '', repo: '', branch: 'main', token: '' };
  } catch {
    return { owner: '', repo: '', branch: 'main', token: '' };
  }
}

function ghSaveSettings(settings) {
  localStorage.setItem(GH_STORAGE_KEY, JSON.stringify(settings));
}

function ghClearSettings() {
  localStorage.removeItem(GH_STORAGE_KEY);
}

function ghApiBase(settings) {
  return `https://api.github.com/repos/${settings.owner}/${settings.repo}/contents`;
}

function utf8ToBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

function base64ToUtf8(b64) {
  return decodeURIComponent(escape(atob(b64)));
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result; // data:<mime>;base64,XXXX
      const base64 = String(result).split(',')[1];
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.readAsDataURL(file);
  });
}

/**
 * Получить файл из репозитория. Возвращает { content, sha } или null если файла нет (404).
 * content — строка (уже декодированная из base64), пригодная для JSON.parse если нужно.
 */
async function ghGetFile(settings, path) {
  const bust = Date.now();
  const res = await fetch(`${ghApiBase(settings)}/${path}?ref=${encodeURIComponent(settings.branch)}&_=${bust}`, {
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${settings.token}`,
      Accept: 'application/vnd.github+json'
    }
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub API: ${res.status} ${res.statusText} (${path})`);
  const data = await res.json();
  return { content: base64ToUtf8(data.content), sha: data.sha };
}

/**
 * Записать/обновить текстовый файл (например data/comics.json).
 */
async function ghPutTextFile(settings, path, textContent, message) {
  const existing = await ghGetFile(settings, path).catch(() => null);
  const body = {
    message,
    content: utf8ToBase64(textContent),
    branch: settings.branch
  };
  if (existing && existing.sha) body.sha = existing.sha;

  const res = await fetch(`${ghApiBase(settings)}/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${settings.token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Не удалось сохранить ${path}: ${res.status} ${err.message || res.statusText}`);
  }
  return res.json();
}

/**
 * Загрузить бинарный файл (картинку страницы) как есть.
 */
async function ghPutBinaryFile(settings, path, file, message) {
  const base64 = await fileToBase64(file);
  const bust = Date.now();
  const existingCheck = await fetch(`${ghApiBase(settings)}/${path}?ref=${encodeURIComponent(settings.branch)}&_=${bust}`, {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${settings.token}`, Accept: 'application/vnd.github+json' }
  });
  let sha = null;
  if (existingCheck.ok) {
    const j = await existingCheck.json();
    sha = j.sha;
  }
  const body = { message, content: base64, branch: settings.branch };
  if (sha) body.sha = sha;

  const res = await fetch(`${ghApiBase(settings)}/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${settings.token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Не удалось загрузить ${path}: ${res.status} ${err.message || res.statusText}`);
  }
  return res.json();
}

async function ghDeleteFile(settings, path, message) {
  const existing = await ghGetFile(settings, path);
  if (!existing) return;
  const res = await fetch(`${ghApiBase(settings)}/${path}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${settings.token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ message, sha: existing.sha, branch: settings.branch })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Не удалось удалить ${path}: ${res.status} ${err.message || res.statusText}`);
  }
}

async function ghTestConnection(settings) {
  const res = await fetch(`https://api.github.com/repos/${settings.owner}/${settings.repo}`, {
    headers: { Authorization: `Bearer ${settings.token}`, Accept: 'application/vnd.github+json' }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `${res.status} ${res.statusText}`);
  }
  return res.json();
}
