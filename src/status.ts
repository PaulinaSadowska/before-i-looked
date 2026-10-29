import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import * as digest from './digest/types.js';
import { lastBeat, type Beat } from './heartbeat.js';

type ReadNight = typeof digest.readNight;

export type NightStatus = {
  night: string;
  ok: number | null;
  retry: number | null;
  fail: number | null;
};

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightStatus[];
};

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

function readNightStatus(runsDir: string, night: string, readNight: ReadNight): NightStatus {
  try {
    const { rows } = readNight(runsDir, night);
    return {
      night,
      ok: rows.filter((row) => row.lastStatus === 'ok').length,
      retry: rows.reduce((count, row) => count + row.retries, 0),
      fail: rows.filter((row) => row.lastStatus === 'fail').length,
    };
  } catch {
    return { night, ok: null, retry: null, fail: null };
  }
}

const defaultReadNight: ReadNight = (runsDir, night) => digest.readNight(runsDir, night);

export function readStatus(config: RigConfig, readNight: ReadNight = defaultReadNight): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightsOnDisk(config.runsDir).map((night) => readNightStatus(config.runsDir, night, readNight)),
  };
}
