#!/bin/bash
# Profile API endpoints with clinic doctor + autocannon
# Extracts: event loop delay, CPU, memory (rss, heapUsed, heapTotal, external), handles, loop utilization
# Flags endpoints exceeding any configured threshold
#
# Prerequisites:
#   1. Node.js >= 24 (enforced by Volta in this repo)
#   2. Install clinic and autocannon globally:
#        npm install -g clinic autocannon
#   3. Build the API first:
#        cd apps/api && npm run build:app
#   4. PostgreSQL running locally with akash-mainnet and console-users databases
#   5. Environment configured via apps/api/env/.env.local (see .env.example)
#
# Usage:
#   cd apps/api
#   bash profile-endpoints.sh
#
# Output:
#   - profile-results.json  (full JSON results, gitignored)
#   - .clinic/               (HTML reports per endpoint, gitignored)

# ──────────────────────────────────────────────────────────
# Tunable thresholds - change these to adjust what gets flagged
# ──────────────────────────────────────────────────────────

# Event loop delay (ms)
DELAY_AVG_THRESHOLD_MS=50
DELAY_P99_THRESHOLD_MS=100
DELAY_MAX_THRESHOLD_MS=200

# CPU usage (%) - percent of a single core
CPU_AVG_THRESHOLD_PCT=80

# Memory (MB) - RSS and heap
RSS_MAX_THRESHOLD_MB=512
HEAP_USED_MAX_THRESHOLD_MB=256

# Autocannon load settings
AUTOCANNON_CONNECTIONS=10   # concurrent connections
AUTOCANNON_DURATION=10      # seconds per endpoint

# Server settings
SERVER_PORT=3080
SERVER_ENTRY="dist/server.js"

# ──────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_FILE="${SCRIPT_DIR}/profile-results.json"
CLINIC_OUTPUT="${SCRIPT_DIR}/.clinic/clinic-output.txt"
mkdir -p "${SCRIPT_DIR}/.clinic"
echo '[]' > "$RESULTS_FILE"

ENDPOINTS=(
  "/v1/providers"
  "/v1/gpu"
  "/v1/gpu-models"
  "/v1/gpu-prices"
  "/v1/dashboard-data"
  "/v1/network-capacity"
  "/v1/provider-versions"
  "/v1/graph-data/compute"
  "/v1/validators"
  "/v1/provider-graph-data/count"
  "/v1/provider-regions"
  "/v1/templates-list"
  "/v1/proposals"
  "/v1/auditors"
  "/v1/blocks"
  "/v1/blocks/1"
  "/v1/transactions"
  "/v1/market-data"
  "/v1/nodes/mainnet"
  "/v1/provider-attributes-schema"
  "/v1/predicted-block-date/99999999"
  "/v1/predicted-date-height/1700000000"
  "/v1/gpu-breakdown"
  "/v1/providers/akash1example"
  "/v1/leases-duration/akash1example"
  "/v1/provider-dashboard/akash1example"
  "/v1/provider-earnings/akash1example"
  "/v1/deployment/akash1example/1"
)

for endpoint in "${ENDPOINTS[@]}"; do
  echo "=== Profiling: $endpoint ==="

  cd "$SCRIPT_DIR"
  INTERFACE=rest clinic doctor --open=false --on-port "autocannon -c ${AUTOCANNON_CONNECTIONS} -d ${AUTOCANNON_DURATION} localhost:${SERVER_PORT}${endpoint}" -- node "$SERVER_ENTRY" > "$CLINIC_OUTPUT" 2>&1

  HTML_FILE=$(ls -t .clinic/*.clinic-doctor.html 2>/dev/null | head -1)

  if [ -z "$HTML_FILE" ]; then
    echo "  No HTML report generated, skipping..."
    continue
  fi

  echo "  Report: $HTML_FILE"

  # Extract full clinic data and autocannon stats
  node -e "
    const fs = require('fs');
    const html = fs.readFileSync('$HTML_FILE', 'utf8');
    const clinicMatch = html.match(/<script type=\"application\/json\" id=\"clinic-data\">\s*([\s\S]*?)\s*<\/script>/);
    const output = fs.readFileSync('$CLINIC_OUTPUT', 'utf8');

    const THRESHOLDS = {
      delay_avg_ms: $DELAY_AVG_THRESHOLD_MS,
      delay_p99_ms: $DELAY_P99_THRESHOLD_MS,
      delay_max_ms: $DELAY_MAX_THRESHOLD_MS,
      cpu_avg_pct: $CPU_AVG_THRESHOLD_PCT,
      rss_max_mb: $RSS_MAX_THRESHOLD_MB,
      heap_used_max_mb: $HEAP_USED_MAX_THRESHOLD_MB,
    };

    let result = {
      endpoint: '$endpoint',
      flagged: false,
      flags: [],
      // Autocannon
      latency_p50_ms: null, latency_p97_ms: null, latency_avg_ms: null,
      req_sec_p50: null, req_sec_avg: null, total_requests: null,
      // Clinic: event loop delay
      delay_avg_ms: null, delay_max_ms: null, delay_p50_ms: null, delay_p99_ms: null,
      // Clinic: CPU
      cpu_avg_pct: null, cpu_max_pct: null,
      // Clinic: Memory (MB)
      rss_avg_mb: null, rss_max_mb: null,
      heap_total_avg_mb: null, heap_total_max_mb: null,
      heap_used_avg_mb: null, heap_used_max_mb: null,
      external_avg_mb: null, external_max_mb: null,
      // Clinic: handles & loop utilization
      handles_avg: null, handles_max: null,
      loop_util_avg: null, loop_util_max: null,
      // Clinic doctor verdict
      clinic_issues: {},
      clinic_issue_category: null,
    };

    // ── Autocannon stats ──
    const latMatch = output.match(/│ Latency │[^│]*│[^│]*│\s*([0-9.]+)\s*ms\s*│\s*([0-9.]+)\s*ms\s*│\s*([0-9.]+)\s*ms\s*│/);
    if (latMatch) {
      result.latency_p50_ms = parseFloat(latMatch[1]);
      result.latency_p97_ms = parseFloat(latMatch[2]);
      result.latency_avg_ms = parseFloat(latMatch[3]);
    }
    const reqMatch = output.match(/│ Req\/Sec[^│]*│[^│]*│[^│]*│\s*([0-9.]+)\s*│[^│]*│\s*([0-9.]+)\s*│/);
    if (reqMatch) {
      result.req_sec_p50 = parseFloat(reqMatch[1]);
      result.req_sec_avg = parseFloat(reqMatch[2]);
    }
    const totalMatch = output.match(/(\d+) requests? in/);
    if (totalMatch) result.total_requests = parseInt(totalMatch[1]);

    // ── Clinic doctor data ──
    if (clinicMatch) {
      const data = JSON.parse(clinicMatch[1]);
      result.clinic_issues = data.analysis?.issues || {};
      result.clinic_issue_category = data.analysis?.issueCategory || null;

      const ps = data.processStat;
      if (ps && Array.isArray(ps)) {
        function stats(arr) {
          if (!arr.length) return { avg: null, max: null, p50: null, p99: null };
          const sorted = [...arr].sort((a,b) => a - b);
          return {
            avg: parseFloat((arr.reduce((a,b) => a+b, 0) / arr.length).toFixed(2)),
            max: parseFloat(Math.max(...arr).toFixed(2)),
            p50: parseFloat(sorted[Math.floor(sorted.length * 0.5)].toFixed(2)),
            p99: parseFloat(sorted[Math.floor(sorted.length * 0.99)].toFixed(2)),
          };
        }
        const toMB = v => v / 1024 / 1024;

        // Event loop delay
        const delays = ps.filter(d => d.delay !== undefined).map(d => d.delay);
        if (delays.length) {
          const s = stats(delays);
          result.delay_avg_ms = s.avg; result.delay_max_ms = s.max;
          result.delay_p50_ms = s.p50; result.delay_p99_ms = s.p99;
        }

        // CPU (percentage)
        const cpus = ps.filter(d => d.cpu !== undefined).map(d => d.cpu);
        if (cpus.length) {
          const s = stats(cpus);
          result.cpu_avg_pct = s.avg; result.cpu_max_pct = s.max;
        }

        // Memory
        const rss = ps.filter(d => d.memory?.rss !== undefined).map(d => toMB(d.memory.rss));
        if (rss.length) { const s = stats(rss); result.rss_avg_mb = s.avg; result.rss_max_mb = s.max; }

        const heapTotal = ps.filter(d => d.memory?.heapTotal !== undefined).map(d => toMB(d.memory.heapTotal));
        if (heapTotal.length) { const s = stats(heapTotal); result.heap_total_avg_mb = s.avg; result.heap_total_max_mb = s.max; }

        const heapUsed = ps.filter(d => d.memory?.heapUsed !== undefined).map(d => toMB(d.memory.heapUsed));
        if (heapUsed.length) { const s = stats(heapUsed); result.heap_used_avg_mb = s.avg; result.heap_used_max_mb = s.max; }

        const external = ps.filter(d => d.memory?.external !== undefined).map(d => toMB(d.memory.external));
        if (external.length) { const s = stats(external); result.external_avg_mb = s.avg; result.external_max_mb = s.max; }

        // Handles
        const handles = ps.filter(d => d.handles !== undefined).map(d => d.handles);
        if (handles.length) { const s = stats(handles); result.handles_avg = s.avg; result.handles_max = s.max; }

        // Loop utilization
        const loopUtil = ps.filter(d => d.loopUtilization !== undefined).map(d => d.loopUtilization);
        if (loopUtil.length) { const s = stats(loopUtil); result.loop_util_avg = s.avg; result.loop_util_max = s.max; }
      }
    }

    // ── Flag against thresholds ──
    if (result.delay_avg_ms !== null && result.delay_avg_ms >= THRESHOLDS.delay_avg_ms)
      result.flags.push('delay_avg=' + result.delay_avg_ms + 'ms (>=' + THRESHOLDS.delay_avg_ms + ')');
    if (result.delay_p99_ms !== null && result.delay_p99_ms >= THRESHOLDS.delay_p99_ms)
      result.flags.push('delay_p99=' + result.delay_p99_ms + 'ms (>=' + THRESHOLDS.delay_p99_ms + ')');
    if (result.delay_max_ms !== null && result.delay_max_ms >= THRESHOLDS.delay_max_ms)
      result.flags.push('delay_max=' + result.delay_max_ms + 'ms (>=' + THRESHOLDS.delay_max_ms + ')');
    if (result.cpu_avg_pct !== null && result.cpu_avg_pct >= THRESHOLDS.cpu_avg_pct)
      result.flags.push('cpu_avg=' + result.cpu_avg_pct + '% (>=' + THRESHOLDS.cpu_avg_pct + ')');
    if (result.rss_max_mb !== null && result.rss_max_mb >= THRESHOLDS.rss_max_mb)
      result.flags.push('rss_max=' + result.rss_max_mb + 'MB (>=' + THRESHOLDS.rss_max_mb + ')');
    if (result.heap_used_max_mb !== null && result.heap_used_max_mb >= THRESHOLDS.heap_used_max_mb)
      result.flags.push('heap_max=' + result.heap_used_max_mb + 'MB (>=' + THRESHOLDS.heap_used_max_mb + ')');

    // Also flag anything clinic itself flagged as 'performance' or 'issue'
    for (const [key, val] of Object.entries(result.clinic_issues)) {
      if (typeof val === 'string' && val !== 'none') {
        result.flags.push('clinic_' + key + '=' + val);
      } else if (typeof val === 'object') {
        for (const [subKey, subVal] of Object.entries(val)) {
          if (subVal !== 'none') result.flags.push('clinic_memory_' + subKey + '=' + subVal);
        }
      }
    }

    result.flagged = result.flags.length > 0;

    // Append to results
    const results = JSON.parse(fs.readFileSync('$RESULTS_FILE', 'utf8'));
    results.push(result);
    fs.writeFileSync('$RESULTS_FILE', JSON.stringify(results, null, 2));

    // Print summary
    const f = result.flagged ? ' ** FLAGGED **' : '';
    console.log('  Event Loop  | avg: ' + (result.delay_avg_ms ?? 'N/A') + 'ms, p99: ' + (result.delay_p99_ms ?? 'N/A') + 'ms, max: ' + (result.delay_max_ms ?? 'N/A') + 'ms');
    console.log('  CPU         | avg: ' + (result.cpu_avg_pct ?? 'N/A') + '%, max: ' + (result.cpu_max_pct ?? 'N/A') + '%');
    console.log('  RSS         | avg: ' + (result.rss_avg_mb ?? 'N/A') + 'MB, max: ' + (result.rss_max_mb ?? 'N/A') + 'MB');
    console.log('  Heap Used   | avg: ' + (result.heap_used_avg_mb ?? 'N/A') + 'MB, max: ' + (result.heap_used_max_mb ?? 'N/A') + 'MB');
    console.log('  Handles     | avg: ' + (result.handles_avg ?? 'N/A') + ', max: ' + (result.handles_max ?? 'N/A'));
    console.log('  Loop Util   | avg: ' + (result.loop_util_avg ?? 'N/A') + ', max: ' + (result.loop_util_max ?? 'N/A'));
    console.log('  Latency     | avg: ' + (result.latency_avg_ms ?? 'N/A') + 'ms, p97: ' + (result.latency_p97_ms ?? 'N/A') + 'ms');
    console.log('  Throughput  | avg: ' + (result.req_sec_avg ?? 'N/A') + ' req/s, total: ' + (result.total_requests ?? 'N/A'));
    console.log('  Clinic      | category: ' + (result.clinic_issue_category ?? 'N/A'));
    if (result.flags.length) console.log('  Flags       | ' + result.flags.join(', ') + f);
    else console.log('  Flags       | none');
  " 2>&1

  echo ""
done

echo "=== All profiling complete ==="
echo "Results saved to: $RESULTS_FILE"
echo ""

# ── Summary table ──
node -e "
  const fs = require('fs');
  const results = JSON.parse(fs.readFileSync('$RESULTS_FILE', 'utf8'));
  const flagged = results.filter(r => r.flagged);

  console.log('=== FLAGGED ENDPOINTS (' + flagged.length + ' of ' + results.length + ') ===');
  console.log('Thresholds: delay_avg>=${DELAY_AVG_THRESHOLD_MS}ms, delay_p99>=${DELAY_P99_THRESHOLD_MS}ms, delay_max>=${DELAY_MAX_THRESHOLD_MS}ms, cpu_avg>=${CPU_AVG_THRESHOLD_PCT}%, rss_max>=${RSS_MAX_THRESHOLD_MB}MB, heap_max>=${HEAP_USED_MAX_THRESHOLD_MB}MB');
  console.log('');

  if (flagged.length === 0) {
    console.log('  None! All endpoints are within thresholds.');
  } else {
    for (const r of flagged.sort((a,b) => (b.flags.length) - (a.flags.length))) {
      console.log('  ' + r.endpoint);
      for (const f of r.flags) {
        console.log('    - ' + f);
      }
      console.log('    Latency avg: ' + (r.latency_avg_ms ?? 'N/A') + 'ms | Req/s: ' + (r.req_sec_avg ?? 'N/A') + ' | Clinic: ' + (r.clinic_issue_category ?? 'N/A'));
      console.log('');
    }
  }

  console.log('=== ALL ENDPOINTS SUMMARY ===');
  console.log('');
  const hdr = 'Endpoint'.padEnd(44) + 'Delay avg'.padStart(10) + 'Delay max'.padStart(10) + ' CPU avg'.padStart(8) + '  RSS max'.padStart(9) + ' Heap max'.padStart(9) + '  Req/s'.padStart(7) + '  Flags'.padStart(3);
  console.log(hdr);
  console.log('-'.repeat(hdr.length));
  for (const r of results) {
    const ep = r.endpoint.padEnd(44);
    const da = ((r.delay_avg_ms ?? '-') + 'ms').padStart(10);
    const dm = ((r.delay_max_ms ?? '-') + 'ms').padStart(10);
    const ca = ((r.cpu_avg_pct ?? '-') + '%').padStart(8);
    const rm = ((r.rss_max_mb ?? '-') + 'MB').padStart(9);
    const hm = ((r.heap_used_max_mb ?? '-') + 'MB').padStart(9);
    const rs = ((r.req_sec_avg ?? '-') + '').padStart(7);
    const fl = r.flags.length > 0 ? ('  ' + r.flags.length) : '  -';
    console.log(ep + da + dm + ca + rm + hm + rs + fl);
  }
"
