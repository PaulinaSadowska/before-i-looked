import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import type { NightDigest, readNight } from '../src/digest/types.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('status board', () => {
  it('links every night on disk and shows its digest counts', async () => {
    const runsDir = mkdtempSync(join(tmpdir(), 'rig-status-'));
    writeFileSync(join(runsDir, '2026-10-27.jsonl'), '');
    writeFileSync(join(runsDir, '2026-10-28.jsonl'), '');
    const digests: Record<string, NightDigest> = {
      '2026-10-27': {
        rows: [
          { job: 'a', owner: 'rook', runs: 1, retries: 0, lastStatus: 'ok', firstTime: 'one', lastTime: 'one' },
        ],
        malformedLines: 0,
      },
      '2026-10-28': {
        rows: [
          { job: 'a', owner: 'rook', runs: 4, retries: 3, lastStatus: 'ok', firstTime: 'one', lastTime: 'four' },
          { job: 'b', owner: null, runs: 1, retries: 0, lastStatus: 'fail', firstTime: 'one', lastTime: 'one' },
        ],
        malformedLines: 1,
      },
    };
    const nightReader = vi.fn<typeof readNight>((_runsDir, night) => digests[night]);

    process.env.LANE_MARKER = 'TEST-MARKER';
    const res = await createApp({ ...config, runsDir }, nightReader).request('/');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('TEST-MARKER');
    expect(html).toContain('href="/digest/2026-10-28"');
    expect(html).toContain('2026-10-28</a> · ok 1 · retry 3 · fail 1');
    expect(html).toContain('href="/digest/2026-10-27"');
    expect(html).toContain('2026-10-27</a> · ok 1 · retry 0 · fail 0');
    expect(nightReader.mock.calls).toEqual([
      [runsDir, '2026-10-28'],
      [runsDir, '2026-10-27'],
    ]);
  });

  it('keeps a night linked and marks counts missing when its digest cannot be read', async () => {
    const runsDir = mkdtempSync(join(tmpdir(), 'rig-status-'));
    writeFileSync(join(runsDir, '2026-10-28.jsonl'), '');
    const nightReader = vi.fn<typeof readNight>(() => {
      throw new Error('unreadable');
    });

    const html = await (await createApp({ ...config, runsDir }, nightReader).request('/')).text();

    expect(html).toContain('href="/digest/2026-10-28"');
    expect(html).toContain('2026-10-28</a> · ok — · retry — · fail —');
  });

  it('health answers with the lane id', async () => {
    const res = await createApp(config).request('/health');
    expect(await res.json()).toEqual({ ok: true, lane: 'lane-07' });
  });
});
