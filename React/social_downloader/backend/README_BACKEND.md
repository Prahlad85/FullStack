# Downloader Backend (Node + Express + yt-dlp)

## Prereqs
- Node.js 18+
- npm
- `yt-dlp` installed and available in PATH.

Install yt-dlp:
- Using pip: `python -m pip install -U yt-dlp`
- Or download binary: https://github.com/yt-dlp/yt-dlp/releases and place it in PATH.
- On Windows you may place `yt-dlp.exe` in a folder and add that folder to PATH.

## Setup
1. copy `.env.example` to `.env` and edit if needed.
2. npm install
3. npm run dev   (requires nodemon) or npm start

## API
POST /api/inspect
Body: { "url": "https://..." }
Response: { id, title, author, thumbnail, duration, formats: [...] }

POST /api/prepare
Body: { "url": "...", "format": { "type": "video"|"audio", "quality": "720p" } }
Response: { token, downloadUrl }

GET /api/download/:token
Streams the prepared file. The file will be deleted after streaming.

## Security & Production notes
- Always add strong abuse protection (CAPTCHA after suspicious activity).
- Use HTTPS and restrict CORS origins.
- Use a persistent queue / store (Redis) for tokens and job status; do not rely on in-memory storage for a multi-instance deployment.
- Enforce quota/rate limits per IP and per user account.
- Consider writing downloads to object storage (S3) with expiring signed URLs rather than streaming from instance disk.
- Read and obey platform terms of service and copyright laws.
