import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import * as digestReader from './digest/types.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { DigestPage, MissingDigest } from './views/digest.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

type ReadNight = typeof digestReader.readNight;

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

export function createApp(config: RigConfig = loadConfig(), readNight: ReadNight = digestReader.readNight) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  app.get('/digest/:night', (c) => {
    const night = c.req.param('night');

    try {
      const digest = readNight(config.runsDir, night);
      return c.html(
        <Layout title={`digest · ${night}`} lane={lane()}>
          <DigestPage night={night} digest={digest} />
        </Layout>,
      );
    } catch (error: unknown) {
      if (!isMissingFile(error)) throw error;

      return c.html(
        <Layout title={`digest · ${night}`} lane={lane()}>
          <MissingDigest night={night} />
        </Layout>,
        404,
      );
    }
  });

  return app;
}
