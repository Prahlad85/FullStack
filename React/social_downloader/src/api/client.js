// src/api/client.js

const BASE = import.meta.env.VITE_API_BASE || ''; // e.g. http://localhost:4000

export async function inspectUrl(url) {
  const res = await fetch(`${BASE}/api/inspect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) throw new Error('Network error');
  return res.json();
}

export async function prepareDownload(id, format) {
  const res = await fetch(`${BASE}/api/prepare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, format }),
  });
  if (!res.ok) throw new Error('Prepare failed');
  return res.json();
}

export async function downloadFile(token, onProgress, signal) {
  const res = await fetch(`${BASE}/api/download/${token}`, {
    method: 'GET',
    signal, // allows cancel with AbortController
  });
  if (!res.ok) throw new Error('Download failed');

  // stream download + progress
  const contentLength = res.headers.get('content-length');
  const reader = res.body.getReader();
  let received = 0;
  const chunks = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (contentLength && onProgress) {
      onProgress(Math.round((received / contentLength) * 100));
    }
  }

  return new Blob(chunks);
}
