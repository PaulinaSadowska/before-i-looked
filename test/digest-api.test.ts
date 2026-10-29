import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NightDigest } from '../src/digest/types.js';

const { readNight } = vi.hoisted(() => ({ readNight: vi.fn() }));

vi.mock('../src/digest/types.js', () => ({ readNight }));

import { createApp } from '../src/app.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: '/runs' };

const nightDigest: NightDigest = {
  rows: [
    {
      job: 'rig/rotate-logs',
      owner: 'lane-07',
      runs: 1,
      retries: 0,
      lastStatus: 'ok',
      firstTime: '2026-10-28T23:00:02+01:00',
      lastTime: '2026-10-28T23:00:02+01:00',
    },
    {
      job: 'digest/render',
      owner: null,
      runs: 1,
      retries: 0,
      lastStatus: 'ok',
      firstTime: '2026-10-29T05:41:09+01:00',
      lastTime: '2026-10-29T05:41:09+01:00',
    },
  ],
  malformedLines: 1,
};

describe('digest JSON API', () => {
  beforeEach(() => {
    readNight.mockReset();
  });

  it('returns the shared digest rows sorted by job', async () => {
    readNight.mockReturnValue(nightDigest);

    const response = await createApp(config).request('/api/digest/2026-10-28');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      rows: [nightDigest.rows[1], nightDigest.rows[0]],
      malformedLines: 1,
    });
    expect(readNight).toHaveBeenCalledWith('/runs', '2026-10-28');
    expect(nightDigest.rows.map((row) => row.job)).toEqual(['rig/rotate-logs', 'digest/render']);
  });

  it('returns 404 when the night does not exist', async () => {
    readNight.mockImplementation(() => {
      throw Object.assign(new Error('missing'), { code: 'ENOENT' });
    });

    const response = await createApp(config).request('/api/digest/missing');

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'night not found' });
  });
});
