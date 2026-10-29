import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import type { NightDigest } from '../src/digest/types.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: '/tmp/runs' };

describe('digest page', () => {
  it('renders sorted rows and marks noteworthy values', async () => {
    const digest: NightDigest = {
      malformedLines: 0,
      rows: [
        {
          job: 'zebra', owner: null, runs: 4, retries: 3, lastStatus: 'fail',
          firstTime: '2026-10-28T01:00:00+01:00', lastTime: '2026-10-28T01:30:00+01:00',
        },
        {
          job: 'alpha', owner: 'ops', runs: 1, retries: 0, lastStatus: 'ok', lastError: 'old error',
          firstTime: '2026-10-28T00:00:00+01:00', lastTime: '2026-10-28T00:00:00+01:00',
        },
      ],
    };
    const readNight = vi.fn(() => digest);

    const response = await createApp(config, readNight).request('/digest/2026-10-28');
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(readNight).toHaveBeenCalledWith('/tmp/runs', '2026-10-28');
    expect(html.indexOf('alpha')).toBeLessThan(html.indexOf('zebra'));
    expect(html).toContain('<td class="warn">3</td>');
    expect(html).toContain('<td class="warn">fail</td>');
    expect(html).toContain('<td>—</td>');
    expect(html).not.toContain('<script');
  });
});
