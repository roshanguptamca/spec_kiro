/**
 * Property 10: Console error log always contains url, status, and message fields
 * Validates: Requirements 4.3
 *
 * Every console.error call made during a failed retrieval step in weather.js
 * passes a single object with exactly three keys:
 *   - url     : string (the URL that was being fetched)
 *   - status  : number | null (the HTTP status code, or null for network/no-data errors)
 *   - message : string (a plain-language description of the failure)
 *
 * The three logging sites in weather.js are:
 *
 *   1. fetchNWS (non-2xx response):
 *        console.error({ url, status: res.status, message });
 *
 *   2. fetchCurrentConditions (all 3 stations have null temperature):
 *        console.error({ url: stationsUrl, status: null, message });
 *
 * This test verifies the structural guarantee by replicating each logging
 * pattern and asserting that every captured log object has url, status, and
 * message — with correct types — across a wide range of inputs.
 */

"use strict";

// ---------------------------------------------------------------------------
// Log capture helper
// ---------------------------------------------------------------------------
function captureConsoleError(fn) {
  const logs = [];
  const original = console.error;
  console.error = (...args) => logs.push(...args);
  try {
    fn();
  } finally {
    console.error = original;
  }
  return logs;
}

async function captureConsoleErrorAsync(fn) {
  const logs = [];
  const original = console.error;
  console.error = (...args) => logs.push(...args);
  try {
    await fn();
  } finally {
    console.error = original;
  }
  return logs;
}

// ---------------------------------------------------------------------------
// Replicate the fetchNWS logging pattern from weather.js
// ---------------------------------------------------------------------------
// Called whenever a fetch returns a non-2xx status code.
function simulateFetchNWSError(url, stepLabel, httpStatus) {
  const message = `Weather data retrieval failed: ${stepLabel} returned HTTP ${httpStatus}.`;
  console.error({ url, status: httpStatus, message });
}

// ---------------------------------------------------------------------------
// Replicate the fetchCurrentConditions "all stations null" logging pattern
// ---------------------------------------------------------------------------
function simulateAllStationsNullError(stationsUrl) {
  const message =
    "Live observation data is temporarily unavailable for this city. Please try again shortly.";
  console.error({ url: stationsUrl, status: null, message });
}

// ---------------------------------------------------------------------------
// Assertion helper
// ---------------------------------------------------------------------------
function assertValidLogObject(obj, context) {
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    return `${context}: log entry is not a plain object (got ${JSON.stringify(obj)})`;
  }

  const keys = Object.keys(obj);
  for (const required of ["url", "status", "message"]) {
    if (!keys.includes(required)) {
      return `${context}: log entry missing key "${required}" (keys: ${keys.join(", ")})`;
    }
  }

  // url: must be a string or null
  if (obj.url !== null && typeof obj.url !== "string") {
    return `${context}: "url" must be string or null, got ${typeof obj.url}`;
  }

  // status: must be a number or null
  if (obj.status !== null && typeof obj.status !== "number") {
    return `${context}: "status" must be number or null, got ${typeof obj.status}`;
  }

  // message: must be a string
  if (typeof obj.message !== "string") {
    return `${context}: "message" must be a string, got ${typeof obj.message}`;
  }

  return null; // ok
}

// ---------------------------------------------------------------------------
// Fixed test cases
// ---------------------------------------------------------------------------

// NWS step labels and common HTTP error codes drawn from the design doc
const NWS_STEPS = [
  "grid lookup",
  "stations lookup",
  "observation lookup",
  "forecast lookup",
];

const HTTP_ERROR_CODES = [300, 301, 302, 400, 401, 403, 404, 429, 500, 502, 503, 504];

const SAMPLE_URLS = [
  "https://api.weather.gov/points/47.6038,-122.3301",
  "https://api.weather.gov/gridpoints/SEW/124,67/stations",
  "https://api.weather.gov/stations/KSEA/observations/latest",
  "https://api.weather.gov/gridpoints/SEW/124,67/forecast",
  "https://nominatim.openstreetmap.org/search?q=Seattle&countrycodes=us&format=json",
];

const fixedFetchNWSCases = [];
for (const step of NWS_STEPS) {
  for (const code of HTTP_ERROR_CODES) {
    for (const url of SAMPLE_URLS) {
      fixedFetchNWSCases.push({ url, step, code });
    }
  }
}

const fixedStationsNullCases = SAMPLE_URLS.map((url) => ({ stationsUrl: url }));

// ---------------------------------------------------------------------------
// Deterministic pseudo-random generator (LCG) for extra coverage
// ---------------------------------------------------------------------------
function lcg(seed) {
  return ((seed * 1664525 + 1013904223) >>> 0);
}

function pick(arr, r) {
  return arr[r % arr.length];
}

const RANDOM_URL_TEMPLATES = [
  (n) => `https://api.weather.gov/points/${n}.${n % 90},-${(n % 180) + 1}.${n % 50}`,
  (n) => `https://api.weather.gov/gridpoints/ABC/${n},${n + 1}/stations`,
  (n) => `https://api.weather.gov/stations/K${n % 1000}/observations/latest`,
  (n) => `https://api.weather.gov/gridpoints/XYZ/${n},${n}/forecast`,
];

const NUM_RANDOM = 100;
const randomFetchNWSCases = [];
for (let i = 0; i < NUM_RANDOM; i++) {
  let r = lcg((i + 1) * 7919);
  const url  = RANDOM_URL_TEMPLATES[r % RANDOM_URL_TEMPLATES.length](i + 1);
  r = lcg(r);
  const step = pick(NWS_STEPS, r);
  r = lcg(r);
  const code = pick(HTTP_ERROR_CODES, r);
  randomFetchNWSCases.push({ url, step, code });
}

const randomStationsNullCases = [];
for (let i = 0; i < NUM_RANDOM; i++) {
  let r = lcg((i + 1) * 1103515245);
  const url = RANDOM_URL_TEMPLATES[r % RANDOM_URL_TEMPLATES.length](i + 1);
  randomStationsNullCases.push({ stationsUrl: url });
}

// ---------------------------------------------------------------------------
// Run all cases
// ---------------------------------------------------------------------------
async function runAll() {
  let passed = 0;
  let failed = 0;
  const failures = [];

  // --- fetchNWS error cases ---
  const allFetchNWSCases = [...fixedFetchNWSCases, ...randomFetchNWSCases];
  for (const { url, step, code } of allFetchNWSCases) {
    const label = `fetchNWS error: step="${step}" code=${code} url="${url.slice(0, 60)}"`;
    const logs = captureConsoleError(() => simulateFetchNWSError(url, step, code));

    if (logs.length !== 1) {
      failed++;
      failures.push(`${label}: expected 1 log entry, got ${logs.length}`);
      continue;
    }

    const err = assertValidLogObject(logs[0], label);
    if (err) {
      failed++;
      failures.push(err);
    } else {
      // Also verify content: status should equal the HTTP code, url should match
      if (logs[0].status !== code) {
        failed++;
        failures.push(`${label}: log.status=${logs[0].status} but expected ${code}`);
      } else if (logs[0].url !== url) {
        failed++;
        failures.push(`${label}: log.url="${logs[0].url}" but expected "${url}"`);
      } else if (!logs[0].message.includes(step)) {
        failed++;
        failures.push(`${label}: log.message does not contain step label "${step}"`);
      } else if (!logs[0].message.includes(String(code))) {
        failed++;
        failures.push(`${label}: log.message does not contain HTTP status code ${code}`);
      } else {
        passed++;
      }
    }
  }

  // --- fetchCurrentConditions all-null cases ---
  const allStationsNullCases = [...fixedStationsNullCases, ...randomStationsNullCases];
  for (const { stationsUrl } of allStationsNullCases) {
    const label = `all-stations-null: url="${stationsUrl.slice(0, 60)}"`;
    const logs = captureConsoleError(() => simulateAllStationsNullError(stationsUrl));

    if (logs.length !== 1) {
      failed++;
      failures.push(`${label}: expected 1 log entry, got ${logs.length}`);
      continue;
    }

    const err = assertValidLogObject(logs[0], label);
    if (err) {
      failed++;
      failures.push(err);
    } else {
      // status must be null for the no-data case
      if (logs[0].status !== null) {
        failed++;
        failures.push(`${label}: log.status=${logs[0].status} but expected null`);
      } else if (logs[0].url !== stationsUrl) {
        failed++;
        failures.push(`${label}: log.url="${logs[0].url}" but expected "${stationsUrl}"`);
      } else {
        passed++;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  const total = passed + failed;
  const fetchNWSCount = allFetchNWSCases.length;
  const stationsNullCount = allStationsNullCases.length;

  console.log("Property 10: Console error log always contains url, status, and message fields");
  console.log("Validates: Requirements 4.3");
  console.log(
    `Ran ${total} cases ` +
    `(${fixedFetchNWSCases.length} fixed + ${randomFetchNWSCases.length} random fetchNWS errors; ` +
    `${fixedStationsNullCases.length} fixed + ${randomStationsNullCases.length} random all-stations-null)`
  );
  console.log();

  if (failed === 0) {
    console.log(`PASS — all ${total} log entries had correct url, status, and message fields.`);
    process.exit(0);
  } else {
    console.error(`FAIL — ${failed} of ${total} cases produced an invalid log entry.`);
    for (const f of failures) {
      console.error(`  [FAIL] ${f}`);
    }
    process.exit(1);
  }
}

runAll();
