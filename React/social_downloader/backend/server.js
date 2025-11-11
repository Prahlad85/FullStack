/**
 * server.js
 *
 * Simple Express backend for inspecting and preparing downloads using yt-dlp.
 *
 * WARNING: Make sure you understand and obey copyright & platform TOU.
 *
 * Requires: yt-dlp binary in PATH (https://github.com/yt-dlp/yt-dlp)
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const PORT = process.env.PORT || 4000;
const TOKEN_TTL_SECONDS = parseInt(process.env.TOKEN_TTL_SECONDS || '300', 10);
const MAX_PREPARE_CONCURRENCY = parseInt(process.env.MAX_PREPARE_CONCURRENCY || '2', 10);

const app = express();
app.use(express.json());
app.use(cors()); // restrict origin in production!

// Basic rate-limiter — increase / configure per real needs
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // limit each IP to 60 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// In-memory token -> { filepath, filename, mime, expiresAt, url, preparing }
// In production use persistent store (Redis) and worker queue.
const tokens = new Map();

// Simple concurrency control for prepare jobs
let currentPrepares = 0;

// Utility: run yt-dlp to get JSON metadata
function runYtDlpJson(url, extraArgs = []) {
  return new Promise((resolve, reject) => {
    // yt-dlp -j URL
    const args = ['-j', '--no-warnings', ...extraArgs, url];
    const proc = spawn('yt-dlp', args);

    let out = '';
    let err = '';
    proc.stdout.on('data', (d) => (out += d.toString()));
    proc.stderr.on('data', (d) => (err += d.toString()));

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(err || `yt-dlp exited with code ${code}`));
      }
      try {
        const json = JSON.parse(out);
        resolve(json);
      } catch (e) {
        reject(new Error('Failed to parse yt-dlp JSON output: ' + e.message));
      }
    });

    proc.on('error', (errProc) => {
      reject(errProc);
    });
  });
}

// Endpoint: POST /api/inspect
// Body: { url }
// Endpoint: POST /api/prepare
app.post('/api/prepare', async (req, res) => {
  const { id, format } = req.body || {};
  if (!id) return res.status(400).json({ error: 'Missing id' });
  if (!format) return res.status(400).json({ error: 'Missing format' });
  
  try {
    // Here you would typically:
    // 1. Check if the ID exists in your tokens/cache
    // 2. Start download with yt-dlp using the format
    // 3. Return a success response
    res.json({ status: 'success', message: 'Download started' });
  } catch (error) {
    console.error('Prepare error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/inspect', async (req, res) => {
  const { url } = req.body || {};
  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'Missing url' });

  // Basic validation: must be http(s)
  if (!/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'Invalid URL' });

  try {
    const info = await runYtDlpJson(url);

    // Map important fields into the contract format
    const formats = (info.formats || []).map((f) => {
      // Try to normalize quality label
      return {
        type: f.acodec === 'none' ? 'video' : (f.vcodec === 'none' ? 'audio' : 'video'),
        quality: f.format_note || f.height ? (f.height ? `${f.height}p` : f.format) : f.format,
        ext: f.ext,
        filesize: f.filesize ? Number(f.filesize) : undefined
      };
    });

    // Deduplicate and sort by quality (simple)
    const uniqueFormats = [];
    const seen = new Set();
    for (const f of formats) {
      const key = `${f.type}-${f.quality}-${f.ext}`;
      if (!seen.has(key)) {
        uniqueFormats.push(f);
        seen.add(key);
      }
    }

    const result = {
      id: info.id || uuidv4(),
      title: info.title,
      author: info.uploader || info.channel || null,
      thumbnail: (info.thumbnails && info.thumbnails.length && info.thumbnails[info.thumbnails.length - 1].url) || info.thumbnail || null,
      duration: info.duration ? `${Math.round(info.duration / 60)}:${String(info.duration % 60).padStart(2, '0')}` : null,
      formats: uniqueFormats
    };

    res.json(result);
  } catch (err) {
    console.error('inspect error:', err);
    if (err.message && err.message.includes('404')) {
      return res.status(404).json({ error: 'Content not found' });
    }
    res.status(500).json({ error: 'Failed to inspect url', details: err.message });
  }
});

// Helper: create a temporary folder + file path
function makeTempFilePath(filenameHint = '') {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dl-'));
  const filename = (filenameHint ? filenameHint.replace(/[^a-z0-9.\-_]/gi, '_') : `output-${Date.now()}`);
  return { dir: tmpDir, filepath: path.join(tmpDir, filename) };
}

// Endpoint: POST /api/prepare
// Body: { id (optional), url, format: {type, quality, ext} }
// If you send id only we should map to previously inspected url; for simplicity accept url here.
app.post('/api/prepare', async (req, res) => {
  const { id, url, format } = req.body || {};

  if (!url && !id) return res.status(400).json({ error: 'Missing url or id' });

  // Very simple concurrency guard
  if (currentPrepares >= MAX_PREPARE_CONCURRENCY) {
    return res.status(429).json({ error: 'Server busy, try again later' });
  }

  try {
    // If only id is provided, in production you'd map id->url via DB/cache.
    const sourceUrl = url; // for this demo require url

    // choose yt-dlp format selection string
    // If client asked for audio extraction, we'll extract audio to mp3
    let isAudio = false;
    let formatArg = 'best';
    if (format && format.type === 'audio') {
      isAudio = true;
      formatArg = 'bestaudio';
    } else if (format && format.quality) {
      // quality might be '1080p' or '720p' — try to pass height-based selector
      const heights = format.quality.match(/(\d+)p/);
      if (heights) {
        formatArg = `bestvideo[height<=${heights[1]}]+bestaudio/best[height<=${heights[1]}]/best`;
      } else {
        formatArg = format.quality || 'best';
      }
    }

    currentPrepares += 1;

    // prepare temp file path
    const { dir, filepath } = makeTempFilePath('download');

    // Build yt-dlp args:
    // -f <formatArg>
    // For audio extraction we'll ask yt-dlp to post-process to mp3 by --extract-audio --audio-format mp3.
    // We'll write to a temp file path and then stream it on GET.
    const outputTemplate = path.join(dir, '%(title)s.%(ext)s'); // yt-dlp will fill in title and ext

    const args = [
      '-f',
      formatArg,
      '--no-mtime',
      '--no-warnings',
      '--no-progress',
      '--no-playlist',
      '-o',
      outputTemplate,
      sourceUrl
    ];

    if (isAudio) {
      args.unshift('--extract-audio', '--audio-format', 'mp3'); // note: preprend not ideal; we'll push instead
      // adjusting: splice to include after '-f'
      // but easiest: append options
      // (we did unshift to quickly include; OK here)
    }

    // spawn yt-dlp and wait for exit (download completes)
    await new Promise((resolve, reject) => {
      const proc = spawn('yt-dlp', args);

      let stderr = '';
      proc.stderr.on('data', (d) => {
        stderr += d.toString();
      });
      proc.on('error', (err) => reject(err));
      proc.on('close', (code) => {
        if (code === 0) {
          return resolve();
        } else {
          return reject(new Error(`yt-dlp exited with code ${code}. stderr: ${stderr}`));
        }
      });
    });

    // find produced file inside dir
    const files = fs.readdirSync(dir);
    if (!files || files.length === 0) {
      // cleanup
      try { fs.rmdirSync(dir, { recursive: true }); } catch {}
      throw new Error('No file produced by yt-dlp');
    }

    // choose first file (should be the downloaded media)
    const producedFile = path.join(dir, files[0]);
    const stat = fs.statSync(producedFile);
    const mime = 'application/octet-stream';
    const filename = path.basename(producedFile);

    // create token and store mapping
    const token = uuidv4();
    const expiresAt = Date.now() + (TOKEN_TTL_SECONDS * 1000);

    tokens.set(token, {
      filepath: producedFile,
      filename,
      size: stat.size,
      mime,
      expiresAt,
      url: sourceUrl,
      preparing: false
    });

    // schedule expiry to delete file after TTL + grace
    setTimeout(() => {
      const t = tokens.get(token);
      if (!t) return;
      // If token still present after TTL, cleanup
      try {
        fs.unlinkSync(t.filepath);
        // remove dir as well
        fs.rmdirSync(path.dirname(t.filepath), { recursive: true });
      } catch (e) {}
      tokens.delete(token);
    }, (TOKEN_TTL_SECONDS + 60) * 1000); // extra 60s grace

    res.json({ token, downloadUrl: `/api/download/${token}` });
  } catch (err) {
    console.error('prepare error', err);
    res.status(500).json({ error: 'Failed to prepare download', details: err.message });
  } finally {
    currentPrepares = Math.max(0, currentPrepares - 1);
  }
});

// Endpoint: GET /api/download/:token
// Streams the prepared file and deletes it after streaming
app.get('/api/download/:token', (req, res) => {
  const token = req.params.token;
  if (!tokens.has(token)) return res.status(404).json({ error: 'Invalid or expired token' });

  const entry = tokens.get(token);

  // If still preparing, reject
  if (entry.preparing) return res.status(423).json({ error: 'Still preparing' });

  // stream file
  const stat = fs.statSync(entry.filepath);
  res.setHeader('Content-Length', stat.size);
  res.setHeader('Content-Disposition', `attachment; filename="${entry.filename}"`);
  res.setHeader('Content-Type', entry.mime || 'application/octet-stream');

  const rs = fs.createReadStream(entry.filepath);
  rs.pipe(res);

  rs.on('end', () => {
    // delete file and dir
    try {
      fs.unlinkSync(entry.filepath);
      fs.rmdirSync(path.dirname(entry.filepath), { recursive: true });
    } catch (e) {
      console.warn('cleanup error', e);
    }
    tokens.delete(token);
  });

  rs.on('error', (err) => {
    console.error('stream error', err);
    try {
      res.destroy();
    } catch {}
    // attempt cleanup
    try {
      fs.unlinkSync(entry.filepath);
      fs.rmdirSync(path.dirname(entry.filepath), { recursive: true });
    } catch (e) {}
    tokens.delete(token);
  });
});

// Simple health endpoint
app.get('/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

// Background cleanup of expired tokens (in case something left)
setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of tokens.entries()) {
    if (entry.expiresAt && entry.expiresAt < now) {
      try {
        fs.unlinkSync(entry.filepath);
        fs.rmdirSync(path.dirname(entry.filepath), { recursive: true });
      } catch {}
      tokens.delete(token);
    }
  }
}, 60 * 1000);

app.listen(PORT, () => console.log(`Downloader backend listening on ${PORT}`));
