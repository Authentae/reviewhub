// Lightweight in-memory request-metrics collector.
//
// No external dependency, no time-series DB — just counters and a small
// ring buffer of response times for percentile estimates. Intended for
// single-instance deployments where the numbers are good enough for "are
// we serving traffic?" and "where are the error bursts?" visibility.
// Resets on restart, which is exactly what a single-instance operator
// usually wants.
//
// Exposed via the admin endpoint /api/admin/metrics; not exported publicly.

const COUNT = {
  total: 0,
  by_status: Object.create(null),
  by_method: Object.create(null),
  by_route: Object.create(null),
};

// Keep a ring buffer of recent response times for p50/p95/p99 estimates.
// 1000 entries is plenty to be statistically meaningful; each entry is a
// small number so memory is negligible.
const LATENCY_RING = new Array(1000).fill(null);
let latencyIdx = 0;
let latencyCount = 0;

function record(req, res, durationMs) {
  COUNT.total++;

  const status = res.statusCode || 0;
  const statusBucket = `${Math.floor(status / 100)}xx`;
  COUNT.by_status[statusBucket] = (COUNT.by_status[statusBucket] || 0) + 1;
  COUNT.by_method[req.method] = (COUNT.by_method[req.method] || 0) + 1;

  // Bucket by the route template (if matched) or a coarse fallback. The
  // template keeps cardinality low — `/api/reviews/:id/respond` instead of
  // one bucket per review id.
  //
  // For UNMATCHED routes (404s from random URL scans / attackers), we
  // collapse them into a single `:unmatched` bucket. Otherwise every
  // weird scan path (`/.env`, `/wp-admin/`, `/api/users/12345`, etc.)
  // would add a new key to by_route — a slow memory leak that grows with
  // attack noise rather than real traffic.
  const route = req.route?.path
    ? `${req.baseUrl || ''}${req.route.path}`
    : (req.path && req.path.startsWith('/api/') ? ':unmatched-api' : ':unmatched');
  if (route) COUNT.by_route[route] = (COUNT.by_route[route] || 0) + 1;

  LATENCY_RING[latencyIdx] = durationMs;
  latencyIdx = (latencyIdx + 1) % LATENCY_RING.length;
  if (latencyCount < LATENCY_RING.length) latencyCount++;
}

function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return null;
  const idx = Math.min(sortedArr.length - 1, Math.floor(sortedArr.length * p));
  return sortedArr[idx];
}

function snapshot() {
  const samples = LATENCY_RING
    .slice(0, latencyCount)
    .filter((v) => typeof v === 'number')
    .sort((a, b) => a - b);
  return {
    requests: {
      total: COUNT.total,
      by_status: { ...COUNT.by_status },
      by_method: { ...COUNT.by_method },
      top_routes: topN(COUNT.by_route, 10),
    },
    latency_ms: {
      sample_size: samples.length,
      p50: percentile(samples, 0.50),
      p95: percentile(samples, 0.95),
      p99: percentile(samples, 0.99),
      max: samples[samples.length - 1] ?? null,
    },
    memory_mb: memoryUsage(),
    uptime_seconds: Math.floor(process.uptime()),
  };
}

function topN(obj, n) {
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {});
}

function memoryUsage() {
  const m = process.memoryUsage();
  return {
    rss: Math.round(m.rss / 1024 / 1024 * 100) / 100,
    heap_used: Math.round(m.heapUsed / 1024 / 1024 * 100) / 100,
    heap_total: Math.round(m.heapTotal / 1024 / 1024 * 100) / 100,
  };
}

// Express middleware. Wraps res.end to capture the final status + elapsed
// time. Setting it up early in the stack gives correct timings for all
// downstream handlers.
function middleware() {
  return function (req, res, next) {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const ns = Number(process.hrtime.bigint() - start);
      record(req, res, ns / 1e6);
    });
    next();
  };
}

module.exports = { middleware, snapshot };
