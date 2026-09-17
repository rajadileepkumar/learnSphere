import { buildApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './db/client.js';

if (!env.DATABASE_URL) {
  const { seedDemoData } = await import('./db/seed-demo.js');
  await seedDemoData(pool);
}

const app = buildApp(pool);

app.listen({ port: env.PORT, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
