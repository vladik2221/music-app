import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import router from './routes.js';

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));
app.use(router);

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`Backend listening on http://localhost:${port}`));
