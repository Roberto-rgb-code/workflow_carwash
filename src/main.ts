import 'dotenv/config';
import path from 'path';
import express from 'express';
import cors from 'cors';
import { api } from './routes';
import { ensureSeedData } from './seed';
import { prisma } from './prisma';

async function bootstrap() {
  const app = express();
  const port = Number(process.env.PORT || 3000);

  app.use(cors());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use(api);

  app.get('/locate/:token', (_req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'locate.html'));
  });

  app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  });

  await prisma.$connect();
  await ensureSeedData();

  app.listen(port, () => {
    console.log(`workflow-carwash listening on :${port}`);
  });
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
