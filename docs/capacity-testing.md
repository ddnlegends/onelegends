# Capacity and event rehearsal

No staging or production capacity result has been measured by this change. A count of registered users cannot establish capacity. Confirm peak simultaneous public visitors, team admins submitting, judges saving, REG operators, dashboard viewers, and expected session length with the event organizer.

## Model the load

Start with a proposed 100 concurrent signed-in users, then the organizer's expected peak and twice that peak, within the hosting and database owner's approved test ceiling. This is a planning example, not a supported-capacity claim. Use realistic counts of teams, roster rows, applications, judges, photos, and scores in a separate Supabase staging project on representative hosting settings.

The live endpoint is polled by active users. Estimate request rate as `active clients / polling interval in seconds`, then add score writes, full-page refreshes, exports, and ordinary browsing. Verify intervals in the current components before the test. Hidden-tab polling is paused, but synchronized active clients and event transitions still create bursts. HTTP request count understates database work: a live request performs authentication and multiple reads.

## Read baseline tool

`scripts/load-smoke.mjs` uses Node 22, makes read-only requests, has bounded users/duration, validates responses, and exits unsuccessfully above its proposed p95/error thresholds. Default is ten virtual users for one minute, one request per user approximately every five seconds. It refuses the known production hostname. Other remote origins require an explicit staging acknowledgement; ensure a custom domain is not production before using it.

```bash
# Public browsing, isolated staging only
LOAD_BASE_URL=https://YOUR-STAGING-HOST \
LOAD_TEST_ACK_STAGING=1 LOAD_USERS=50 LOAD_SECONDS=300 npm run test:load

# Authorized live-state scenario: same host, with a short-lived synthetic
# judge/REG session cookie supplied securely in LOAD_SESSION_COOKIE and the
# synthetic competition ID supplied in LOAD_COMPETITION_ID.
# Do not paste cookies into shared command history, issues, or CI logs.
```

The authorized scenario requires both variables and checks the JSON contract, so a redirect to login or a 403 cannot be mistaken for a fast success. One shared account cookie tests read pressure, not distinct-session behavior. Run a real multi-account judge/REG rehearsal separately. Do not use the public-page baseline to infer authenticated scoring capacity.

## Full rehearsal and acceptance

1. Warm up for five minutes; record cold-start behavior separately. Ramp through expected and double-peak scenarios; maintain the peak for at least 30 minutes.
2. Have distinct synthetic judges score simultaneously, REG switch teams, comp admins view progress, and one tech admin export a realistically sized dataset. Exercise double-submit, background tabs, refresh, delayed requests, and a short network interruption. Do not send real Google sign-in through a load generator.
3. Compare every submitted score and packet with expected values in the database. Verify no duplicate application, early release, wrong-competition access, or lost write. Stress tests need correctness assertions, not just response times.
4. Measure browser save/refresh time, HTTP p50/p95/p99, errors, app memory/CPU, database connections, CPU, memory, slow queries/locks, pool timeouts, and provider limits. Capture deployment SHA and configuration along with the results.
5. Proposed initial acceptance: score-save and live-read p95 under 1 second, page p95 under 2 seconds, errors below 1%, zero data-integrity failures, no pool timeouts, and at least 20% connection headroom. The release lead must accept targets against real event needs.
6. Stop on lost scores, unauthorized exposure, DB saturation, rising timeouts, or provider-budget alarms. Diagnose before increasing load. Keep the test below agreed cost/traffic ceilings.

## Evidence record

| Field | Record |
| --- | --- |
| Release SHA / deployment | Pending |
| Peak usage assumptions and source | Pending organizer confirmation |
| DB/hosting configuration and ceiling | Pending owner confirmation |
| Dataset sizes and scenarios | Pending |
| Duration / achieved request rate | Pending |
| p95/p99 latency and error rates | Pending |
| Peak DB connections / pool timeouts | Pending |
| Score/application reconciliation | Pending |
| Known bottlenecks and fixes | Pending |
| Accepted by / date | Pending |

If capacity is insufficient, first inspect query volume, pooling, locks, indexes, large exports, and poll frequency. Upgrade resources only with owner approval and a measured reason. The repository's existing storage-capacity PDF is not a concurrency benchmark.
