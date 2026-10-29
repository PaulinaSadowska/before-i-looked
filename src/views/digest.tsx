import type { DigestRow, NightDigest } from '../digest/types.js';

const missing = '—';

function DigestTable({ rows }: { rows: DigestRow[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>job</th>
          <th>owner</th>
          <th>runs</th>
          <th>retries</th>
          <th>last status</th>
          <th>last error</th>
          <th>first time</th>
          <th>last time</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr>
            <td>{row.job}</td>
            <td>{row.owner ?? missing}</td>
            <td>{row.runs}</td>
            <td class={row.retries >= 3 ? 'warn' : undefined}>{row.retries}</td>
            <td class={row.lastStatus === 'fail' ? 'warn' : undefined}>{row.lastStatus}</td>
            <td>{row.lastError ?? missing}</td>
            <td>{row.firstTime}</td>
            <td>{row.lastTime}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DigestPage({ night, digest }: { night: string; digest: NightDigest }) {
  const rows = [...digest.rows].sort((left, right) => left.job.localeCompare(right.job));

  return (
    <>
      <h1>digest · {night}</h1>
      {rows.length === 0 ? <p class="mute">nothing ran</p> : <DigestTable rows={rows} />}
    </>
  );
}

export function MissingDigest({ night }: { night: string }) {
  return (
    <>
      <h1>digest · {night}</h1>
      <p class="warn">night not found</p>
    </>
  );
}
