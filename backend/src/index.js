import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import router from './routes.js';

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());

// Serve cover images statically at /covers/*
const coverDir = path.resolve(process.env.COVER_DIR || './uploads/covers');
fs.mkdirSync(coverDir, { recursive: true });
app.use('/covers', express.static(coverDir));

app.get('/health', (req, res) => res.json({ ok: true }));
app.use(router);

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`Backend listening on http://localhost:${port}`));
