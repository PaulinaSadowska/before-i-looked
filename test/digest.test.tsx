import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { NightDigest } from '../src/digest/types.js';

const night = '2026-10-29';

let runsDir: string;

beforeEach(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
});

afterEach(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

function app() {
  return createApp({
    adapter: 'test',
    installed: '2026-10-29T06:00:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  });
}

function writeNight(lines: Array<string | Record<string, unknown>>) {
  const contents = lines
    .map((line) => (typeof line === 'string' ? line : JSON.stringify(line)))
    .join('\n');
  writeFileSync(join(runsDir, `${night}.jsonl`), contents === '' ? '' : `${contents}\n`);
}

function jobsInTable(html: string): string[] {
  const tableBody = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i)?.[1];
  expect(tableBody, 'digest page should render its jobs in a table body').toBeDefined();

  return [...(tableBody ?? '').matchAll(/<tr[^>]*>[\s\S]*?<td[^>]*>([^<]*)<\/td>/gi)].map(
    ([, job]) => job.trim(),
  );
}

const successLines: Array<Record<string, unknown>> = [
  {
    at: '2026-10-29T01:00:00+01:00',
    job: 'bravo-job',
    status: 'retry',
    owner: 'Bea',
    error: 'busy',
  },
  {
    at: '2026-10-29T00:30:00+01:00',
    job: 'alpha-job',
    status: 'ok',
    owner: 'Ari',
  },
  {
    at: '2026-10-29T02:00:00+01:00',
    job: 'bravo-job',
    status: 'fail',
    owner: 'Bea',
    error: 'timed out',
  },
];

describe('GET /digest/:night', () => {
  it('renders a successful night as a job-sorted table', async () => {
    writeNight(successLines);

    const response = await app().request(`/digest/${night}`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(jobsInTable(html)).toEqual(['alpha-job', 'bravo-job']);
    expect(html).toContain('Ari');
    expect(html).toContain('timed out');
  });

  it('returns 404 when the night file is missing', async () => {
    const response = await app().request(`/digest/${night}`);

    expect(response.status).toBe(404);
  });

  it('renders the empty state for an empty night', async () => {
    writeNight([]);

    const response = await app().request(`/digest/${night}`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toMatch(/nothing ran/i);
  });

  it('still renders valid jobs when one line is malformed', async () => {
    writeNight([
      {
        at: '2026-10-29T03:00:00+01:00',
        job: 'kept-job',
        status: 'ok',
        owner: null,
      },
      '{not valid JSON',
    ]);

    const response = await app().request(`/digest/${night}`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(jobsInTable(html)).toEqual(['kept-job']);
    expect(html).toContain('—');
  });
});

describe('GET /api/digest/:night', () => {
  it('returns the aggregated digest for a successful night', async () => {
    writeNight(successLines);

    const response = await app().request(`/api/digest/${night}`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({
      rows: [
        {
          job: 'alpha-job',
          owner: 'Ari',
          runs: 1,
          retries: 0,
          lastStatus: 'ok',
          firstTime: '2026-10-29T00:30:00+01:00',
          lastTime: '2026-10-29T00:30:00+01:00',
        },
        {
          job: 'bravo-job',
          owner: 'Bea',
          runs: 2,
          retries: 1,
          lastStatus: 'fail',
          lastError: 'timed out',
          firstTime: '2026-10-29T01:00:00+01:00',
          lastTime: '2026-10-29T02:00:00+01:00',
        },
      ],
      malformedLines: 0,
    });
  });

  it('returns 404 when the night file is missing', async () => {
    const response = await app().request(`/api/digest/${night}`);

    expect(response.status).toBe(404);
  });

  it('returns an empty digest for an empty night', async () => {
    writeNight([]);

    const response = await app().request(`/api/digest/${night}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ rows: [], malformedLines: 0 });
  });

  it('counts a malformed line and returns the valid rows', async () => {
    writeNight([
      {
        at: '2026-10-29T03:00:00+01:00',
        job: 'kept-job',
        status: 'ok',
        owner: null,
      },
      '{not valid JSON',
    ]);

    const response = await app().request(`/api/digest/${night}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      rows: [
        {
          job: 'kept-job',
          owner: null,
          runs: 1,
          retries: 0,
          lastStatus: 'ok',
          firstTime: '2026-10-29T03:00:00+01:00',
          lastTime: '2026-10-29T03:00:00+01:00',
        },
      ],
      malformedLines: 1,
    });
  });
});

it('keeps the page and API jobs in identical sorted order', async () => {
  writeNight([
    {
      at: '2026-10-29T00:00:00+01:00',
      job: 'zulu-job',
      status: 'ok',
      owner: 'Zed',
    },
    {
      at: '2026-10-29T00:01:00+01:00',
      job: 'alpha-job',
      status: 'retry',
      owner: 'Ari',
    },
    {
      at: '2026-10-29T00:02:00+01:00',
      job: 'middle-job',
      status: 'fail',
      owner: 'Moe',
      error: 'stopped',
    },
  ]);

  const [pageResponse, apiResponse] = await Promise.all([
    app().request(`/digest/${night}`),
    app().request(`/api/digest/${night}`),
  ]);
  const html = await pageResponse.text();
  const digest = (await apiResponse.json()) as NightDigest;
  const pageJobs = jobsInTable(html);
  const apiJobs = digest.rows.map((row) => row.job);

  expect(pageResponse.status).toBe(200);
  expect(apiResponse.status).toBe(200);
  expect(pageJobs).toEqual(apiJobs);
  expect(pageJobs).toEqual(['alpha-job', 'middle-job', 'zulu-job']);
});
