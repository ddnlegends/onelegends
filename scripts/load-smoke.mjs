import { setTimeout as sleep } from 'node:timers/promises';

// Read-only baseline. This is not a substitute for multi-user score-write load.
const base = new URL(process.env.LOAD_BASE_URL || 'http://127.0.0.1:3100');
const local = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.pathname !== '/' || base.search || base.hash) {
  throw new Error('LOAD_BASE_URL must be an HTTP(S) origin without credentials, path, or query.');
}
if (base.hostname === 'onelegends.vercel.app' || (!local && process.env.LOAD_TEST_ACK_STAGING !== '1')) {
  throw new Error('Use isolated staging and set LOAD_TEST_ACK_STAGING=1 for a remote target. The known production host is refused.');
}
function bounded(name, fallback, min, max) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} must be between ${min} and ${max}.`);
  return value;
}
const users = bounded('LOAD_USERS', 10, 1, 500);
const seconds = bounded('LOAD_SECONDS', 60, 5, 900);
const competition = process.env.LOAD_COMPETITION_ID;
const cookie = process.env.LOAD_SESSION_COOKIE;
if (Boolean(competition) !== Boolean(cookie)) throw new Error('Set both LOAD_COMPETITION_ID and LOAD_SESSION_COOKIE for authorized live polling.');
const routes = competition ? [`/api/live/${encodeURIComponent(competition)}`] : ['/', '/login', '/register'];
const samples = [];
let errors = 0;
const started = performance.now();
const deadline = started + seconds * 1000;
await Promise.all(Array.from({ length: users }, async (_, user) => {
  await sleep((user / users) * 1000);
  let iteration = 0;
  while (performance.now() < deadline) {
    const start = performance.now();
    try {
      const response = await fetch(new URL(routes[iteration++ % routes.length], base), {
        redirect: 'manual', signal: AbortSignal.timeout(10_000),
        headers: cookie ? { cookie } : {},
      });
      if (response.status !== 200) throw new Error('Unexpected response');
      if (competition) {
        const body = await response.json();
        if (typeof body.judgingOpen !== 'boolean' || !('livePosition' in body)) throw new Error('Invalid live response');
      } else {
        if (!(await response.text()).includes('OneLegends')) throw new Error('Unexpected page');
      }
    } catch { errors++; }
    samples.push(performance.now() - start);
    await sleep(Math.min(5000, Math.max(0, deadline - performance.now())));
  }
}));
samples.sort((a, b) => a - b);
const p95 = samples[Math.max(0, Math.ceil(samples.length * 0.95) - 1)] || 0;
const errorRate = samples.length ? errors / samples.length : 1;
const limit = competition ? 1000 : 2000;
const result = {
  scenario: competition ? 'authorized-live-read' : 'public-page-read', users, seconds,
  requests: samples.length, errors, errorRate, p95ms: Math.round(p95),
  requestsPerSecond: +(samples.length / ((performance.now() - started) / 1000)).toFixed(2),
  thresholds: { p95ms: limit, errorRate: 0.01 },
  passed: p95 < limit && errorRate < 0.01,
};
console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exitCode = 1;
