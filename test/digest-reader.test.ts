import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/types.js';

const runsDir = fileURLToPath(new URL('../runs', import.meta.url));

describe('readNight', () => {
  it('aggregates the real night fixture without changing it', () => {
    expect(readNight(runsDir, '2026-10-28')).toEqual({
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
          job: 'lane/sync',
          owner: 'rook',
          runs: 8,
          retries: 1,
          lastStatus: 'ok',
          lastError: 'lock held',
          firstTime: '2026-10-28T23:00:06+01:00',
          lastTime: '2026-10-29T05:00:04+01:00',
        },
        {
          job: 'fixtures/refresh',
          owner: 'rook',
          runs: 4,
          retries: 3,
          lastStatus: 'ok',
          lastError: 'upstream 503',
          firstTime: '2026-10-29T01:30:00+01:00',
          lastTime: '2026-10-29T01:37:00+01:00',
        },
        {
          job: 'notes/backup',
          owner: 'lane-07',
          runs: 1,
          retries: 0,
          lastStatus: 'fail',
          lastError: 'quota exceeded',
          firstTime: '2026-10-29T04:00:01+01:00',
          lastTime: '2026-10-29T04:00:01+01:00',
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
    });
  });

  it('keeps offsets and the latest nullable owner while skipping malformed records', () => {
    const directory = mkdtempSync(join(tmpdir(), 'rig-reader-'));

    try {
      writeFileSync(
        join(directory, 'night.jsonl'),
        [
          '{not json}',
          'null',
          '{"at":"2026-01-01T01:00:00+02:00","job":"job/a","status":"retry","owner":"first","error":"wait"}',
          '{"at":"2025-12-31T23:30:00-03:00","job":"job/a","status":"ok","owner":null}',
          '{"at":"missing fields","job":"job/b","status":"ok"}',
          '',
        ].join('\n'),
      );

      expect(readNight(directory, 'night')).toEqual({
        rows: [
          {
            job: 'job/a',
            owner: null,
            runs: 2,
            retries: 1,
            lastStatus: 'ok',
            lastError: 'wait',
            firstTime: '2026-01-01T01:00:00+02:00',
            lastTime: '2025-12-31T23:30:00-03:00',
          },
        ],
        malformedLines: 3,
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
