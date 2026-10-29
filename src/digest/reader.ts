import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, NightDigest, RunStatus } from './types.js';

type RunRecord = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStatus(value: unknown): value is RunStatus {
  return value === 'ok' || value === 'retry' || value === 'fail';
}

function parseRunRecord(line: string): RunRecord | null {
  let value: unknown;

  try {
    value = JSON.parse(line) as unknown;
  } catch {
    return null;
  }

  if (
    !isRecord(value) ||
    typeof value.at !== 'string' ||
    typeof value.job !== 'string' ||
    !isStatus(value.status) ||
    (typeof value.owner !== 'string' && value.owner !== null) ||
    ('error' in value && typeof value.error !== 'string')
  ) {
    return null;
  }

  const record: RunRecord = {
    at: value.at,
    job: value.job,
    status: value.status,
    owner: value.owner,
  };
  if (typeof value.error === 'string') record.error = value.error;
  return record;
}

function addRecord(rows: Map<string, DigestRow>, record: RunRecord): void {
  const row = rows.get(record.job);

  if (!row) {
    rows.set(record.job, {
      job: record.job,
      owner: record.owner,
      runs: 1,
      retries: record.status === 'retry' ? 1 : 0,
      lastStatus: record.status,
      ...(record.error === undefined ? {} : { lastError: record.error }),
      firstTime: record.at,
      lastTime: record.at,
    });
    return;
  }

  row.owner = record.owner;
  row.runs += 1;
  row.retries += record.status === 'retry' ? 1 : 0;
  row.lastStatus = record.status;
  row.lastTime = record.at;
  if (record.error !== undefined) row.lastError = record.error;
}

export function readNight(runsDir: string, night: string): NightDigest {
  const contents = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  const lines = contents.split(/\r?\n/);
  if (lines.at(-1) === '') lines.pop();

  const rows = new Map<string, DigestRow>();
  let malformedLines = 0;

  for (const line of lines) {
    const record = parseRunRecord(line);
    if (!record) {
      malformedLines += 1;
      continue;
    }
    addRecord(rows, record);
  }

  return { rows: [...rows.values()], malformedLines };
}
