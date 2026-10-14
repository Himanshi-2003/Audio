# Subtitle Studio — React + Express + MongoDB

A full-stack subtitle editor starter with a React/Vite UI, Express REST API, and MongoDB/Mongoose persistence.

## Features
- Dark responsive React interface
- Upload and preview a local video (video stays in the browser)
- Create, edit, select, delete, and time subtitles
- Timeline and generated audio waveform using the browser Web Audio API
- Export subtitles as SRT or WebVTT
- Extract supported video audio to WAV in the browser
- Save/load project metadata and subtitle tracks through MongoDB
- Health endpoint and input validation

> Speech-to-text transcription is not implemented. Audio decoding depends on browser codec support. The video file itself is not uploaded to the server; only project metadata and subtitles are saved in MongoDB.

## Requirements
- Node.js 18+
- MongoDB running locally or a MongoDB Atlas database

## Setup
1. Install dependencies:
   ```bash
   npm run install:all
   ```
2. Copy `server/.env.example` to `server/.env`.
3. Set `MONGODB_URI`.
   - Local MongoDB: `mongodb://127.0.0.1:27017/subtitle_studio`
   - Atlas: copy the full `mongodb+srv://...` connection string from Atlas. Do not use `localhost` with `mongodb+srv://`.
4. Start both apps:
   ```bash
   npm run dev
   ```
5. Open `http://localhost:5173`. API runs on `http://localhost:5000`.

## Troubleshooting MongoDB
- `querySrv ENODATA _mongodb._tcp.localhost` means the URI likely uses `mongodb+srv://localhost`. For local MongoDB, use `mongodb://127.0.0.1:27017/subtitle_studio`.
- `ECONNREFUSED 127.0.0.1:27017` means the local MongoDB service is not running or is not listening on that port.
- For Atlas, make sure the URI is copied from **Connect → Drivers**, your IP is allowed in Network Access, and the database user credentials are correct.
- URL-encode reserved characters in the database password.
- Restart the backend after changing `server/.env`.

## Production build
```bash
npm run build
npm start
```
The Express server serves the built React app from `client/dist` when it exists.

## API
- `GET /api/health`
- `GET /api/projects`
- `POST /api/projects` — `{ "name": "My project" }`
- `GET /api/projects/:id`
- `PATCH /api/projects/:id` — `{ "name": "Updated name" }`
- `DELETE /api/projects/:id`
- `POST /api/projects/:id/subtitles` — `{ "start": 0, "end": 2, "text": "Hello" }`
- `PUT /api/projects/:id/subtitles/:subtitleId` — updates subtitle fields
- `DELETE /api/projects/:id/subtitles/:subtitleId`
- `PUT /api/projects/:id/subtitles` — replace entire subtitle list

## Data note
Project records and subtitle text/timings are persisted in MongoDB. Browser media URLs are temporary and intentionally not saved. For production video storage, add authenticated uploads to object storage (S3/Cloudinary/etc.) instead of keeping large video files in MongoDB.
