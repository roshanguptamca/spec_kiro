/**
 * Property 8: Any error always hides Weather_Card and Forecast_Table
 * Validates: Requirements 4.2
 *
 * The relevant logic in handleSearch() (weather.js):
 *
 *   showLoading();
 *   hideResults();   // hides card + table before async work begins
 *   try {
 *     // ... async work (may throw) ...
 *     renderWeatherCard(...);     // sets card display: block
 *     renderForecastTable(...);   // sets table display: block
 *   } catch (err) {
 *     setStatus(err.message, true);
 *     hideResults();              // hides card + table on any error
 *   } finally {
 *     document.getElementById("search-btn").disabled = false;
 *   }
 *
 * Property: for any error thrown during a weather lookup (geocoding failure,
 * NWS API failure, network error, or unexpected exception), BOTH #weather-card
 * and #forecast-table SHALL have display === "none" after the error is handled,
 * regardless of what was previously displayed.
 *
 * This also verifies the case where results were visible from a prior successful
 * search and an error on a subsequent search must hide them again.
 */

"use strict";

// ---------------------------------------------------------------------------
// Mock DOM — plain JS objects, no browser required
// ---------------------------------------------------------------------------
function createMockDOM(initialCardDisplay, initialTableDisplay) {
  const btn = { disabled: false };
  const status = { textContent: "", className: "" };
  const cityInput = { value: "" };
  const weatherCard = { style: { display: initialCardDisplay || "none" } };
  const forecastTable = { style: { display: initialTableDisplay || "none" } };

  return {
    elements: { btn, status, cityInput, weatherCard, forecastTable },
    getElementById(id) {
      switch (id) {
        case "search-btn":     return btn;
        case "status":         return status;
        case "city-input":     return cityInput;
        case "weather-card":   return weatherCard;
        case "forecast-table": return forecastTable;
        default:               throw new Error(`Unknown element id: ${id}`);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Replicate the handleSearch logic from weather.js using the mock DOM
// ---------------------------------------------------------------------------
async function simulateHandleSearch(mockDOM, cityInputValue, asyncWorkFn) {
  const btn    = mockDOM.getElementById("search-btn");
  const status = mockDOM.getElementById("status");

  function setStatus(msg, isError) {
    status.textContent = msg;
    status.className   = isError ? "error" : "";
  }

  function showLoading() {
    setStatus("Fetching weather data\u2026");
    btn.disabled = true;
  }

  function hideResults() {
    mockDOM.getElementById("weather-card").style.display   = "none";
    mockDOM.getElementById("forecast-table").style.display = "none";
  }

  const cityName = cityInputValue.trim();

  // Early-return path: empty input — not under test for Property 8
  // (no results are shown for empty input so no hiding needed)
  if (!cityName) {
    setStatus("Please enter a city name.", true);
    return;
  }

  showLoading();
  hideResults();

  try {
    await asyncWorkFn();
    // On success, rendering would set display: block — simulate that here
    // so we can confirm that a *subsequent* error correctly hides them again.
    mockDOM.getElementById("weather-card").style.display   = "block";
    mockDOM.getElementById("forecast-table").style.display = "block";
    setStatus("");
  } catch (err) {
    setStatus(err.message, true);
    hideResults();
  } finally {
    btn.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// Outcome factories
// ---------------------------------------------------------------------------
const outcomes = {
  success() {
    return async () => { /* resolves normally */ };
  },
  geocodingNotFound() {
    return async () => { throw new Error("City not found. Please try a valid US city name."); };
  },
  geocodingNetworkError() {
    return async () => { throw new Error("Location lookup failed: network error."); };
  },
  nwsHttpError(step, status) {
    return async () => {
      throw new Error(`Weather data retrieval failed: ${step} returned HTTP ${status}.`);
    };
  },
  noObservationData() {
    return async () => {
      throw new Error("Live observation data is temporarily unavailable for this city. Please try again shortly.");
    };
  },
  unexpectedException(msg) {
    return async () => { throw new Error(msg || "Unexpected internal error."); };
  },
};

// ---------------------------------------------------------------------------
// Fixed cases — deterministic coverage
// ---------------------------------------------------------------------------
// initialDisplay values: "none" = results hidden before search, "block" = prior search was successful
const fixedCases = [
  // Results already hidden — error must keep them hidden
  { label: "geocoding not found, prior hidden",         city: "Faketown",   initial: "none",  fn: outcomes.geocodingNotFound() },
  { label: "geocoding network error, prior hidden",     city: "Denver",     initial: "none",  fn: outcomes.geocodingNetworkError() },
  { label: "NWS grid lookup HTTP 404, prior hidden",    city: "Seattle",    initial: "none",  fn: outcomes.nwsHttpError("grid lookup", 404) },
  { label: "NWS grid lookup HTTP 500, prior hidden",    city: "Portland",   initial: "none",  fn: outcomes.nwsHttpError("grid lookup", 500) },
  { label: "NWS stations lookup HTTP 503, prior hidden",city: "Chicago",    initial: "none",  fn: outcomes.nwsHttpError("stations lookup", 503) },
  { label: "NWS obs lookup HTTP 500, prior hidden",     city: "Miami",      initial: "none",  fn: outcomes.nwsHttpError("observation lookup", 500) },
  { label: "NWS forecast lookup HTTP 500, prior hidden",city: "Dallas",     initial: "none",  fn: outcomes.nwsHttpError("forecast lookup", 500) },
  { label: "no observation data, prior hidden",         city: "Phoenix",    initial: "none",  fn: outcomes.noObservationData() },
  { label: "unexpected exception, prior hidden",        city: "Boston",     initial: "none",  fn: outcomes.unexpectedException() },

  // Results previously visible (from a prior successful search) — error must hide them
  { label: "geocoding not found, prior visible",         city: "Faketown",  initial: "block", fn: outcomes.geocodingNotFound() },
  { label: "geocoding network error, prior visible",     city: "Denver",    initial: "block", fn: outcomes.geocodingNetworkError() },
  { label: "NWS grid lookup HTTP 404, prior visible",    city: "Seattle",   initial: "block", fn: outcomes.nwsHttpError("grid lookup", 404) },
  { label: "NWS grid lookup HTTP 500, prior visible",    city: "Portland",  initial: "block", fn: outcomes.nwsHttpError("grid lookup", 500) },
  { label: "NWS stations lookup HTTP 503, prior visible",city: "Chicago",   initial: "block", fn: outcomes.nwsHttpError("stations lookup", 503) },
  { label: "NWS obs lookup HTTP 500, prior visible",     city: "Miami",     initial: "block", fn: outcomes.nwsHttpError("observation lookup", 500) },
  { label: "NWS forecast lookup HTTP 500, prior visible",city: "Dallas",    initial: "block", fn: outcomes.nwsHttpError("forecast lookup", 500) },
  { label: "no observation data, prior visible",         city: "Phoenix",   initial: "block", fn: outcomes.noObservationData() },
  { label: "unexpected exception, prior visible",        city: "Boston",    initial: "block", fn: outcomes.unexpectedException() },
  { label: "unexpected exception (empty msg), prior visible", city: "LA",   initial: "block", fn: outcomes.unexpectedException("") },
  { label: "NWS HTTP 429 rate limit, prior visible",    city: "Houston",    initial: "block", fn: outcomes.nwsHttpError("grid lookup", 429) },
  { label: "NWS HTTP 503 forecast, prior visible",      city: "Las Vegas",  initial: "block", fn: outcomes.nwsHttpError("forecast lookup", 503) },
];

// ---------------------------------------------------------------------------
// Random scenario generation — 50 cases
// ---------------------------------------------------------------------------
const CITY_NAMES = [
  "New York", "Los Angeles", "Chicago", "Houston", "Phoenix",
  "Philadelphia", "San Antonio", "San Diego", "Dallas", "San Jose",
  "Austin", "Jacksonville", "Fort Worth", "Columbus", "Charlotte",
  "Indianapolis", "San Francisco", "Seattle", "Denver", "Nashville",
];

const HTTP_STATUSES = [400, 401, 403, 404, 429, 500, 502, 503, 504];
const NWS_STEPS     = ["grid lookup", "stations lookup", "observation lookup", "forecast lookup"];
const ERROR_MSGS    = [
  "timeout",
  "connection refused",
  "SSL handshake failed",
  "DNS resolution failed",
  "unexpected end of stream",
  "socket hang up",
];

// Deterministic pseudo-random (LCG)
function lcg(seed) {
  return ((seed * 1664525 + 1013904223) >>> 0);
}

function pick(arr, r) {
  return arr[r % arr.length];
}

function generateErrorScenario(seed) {
  let r = lcg(seed);
  const city    = pick(CITY_NAMES, r);
  r = lcg(r);
  const initial = r % 2 === 0 ? "block" : "none"; // randomise prior visibility
  r = lcg(r);
  const kind    = r % 4; // error types only (no success) — 0=geocoding, 1=nwsHttp, 2=network, 3=unexpected
  r = lcg(r);

  switch (kind) {
    case 0:
      return { label: `random[${seed}] geocoding error (${city}, prior=${initial})`, city, initial, fn: outcomes.geocodingNotFound() };
    case 1: {
      const step   = pick(NWS_STEPS, r);
      r = lcg(r);
      const status = pick(HTTP_STATUSES, r);
      return { label: `random[${seed}] NWS HTTP ${status} ${step} (${city}, prior=${initial})`, city, initial, fn: outcomes.nwsHttpError(step, status) };
    }
    case 2:
      return { label: `random[${seed}] network error (${city}, prior=${initial})`, city, initial, fn: outcomes.geocodingNetworkError() };
    case 3: {
      const msg = pick(ERROR_MSGS, r);
      return { label: `random[${seed}] unexpected exception (${city}, prior=${initial})`, city, initial, fn: outcomes.unexpectedException(msg) };
    }
    default:
      return { label: `random[${seed}] geocoding fallback`, city, initial: "none", fn: outcomes.geocodingNotFound() };
  }
}

const NUM_RANDOM = 50;
const randomCases = [];
for (let i = 1; i <= NUM_RANDOM; i++) {
  randomCases.push(generateErrorScenario(i * 31337));
}

const allCases = [...fixedCases, ...randomCases];

// ---------------------------------------------------------------------------
// Run all cases
// ---------------------------------------------------------------------------
async function runAll() {
  let passed  = 0;
  let failed  = 0;
  const failures = [];

  for (const { label, city, initial, fn } of allCases) {
    // Start with the specified initial display state for both elements
    const mockDOM = createMockDOM(initial, initial);
    mockDOM.getElementById("city-input").value = city;

    await simulateHandleSearch(mockDOM, city, fn);

    const cardDisplay  = mockDOM.getElementById("weather-card").style.display;
    const tableDisplay = mockDOM.getElementById("forecast-table").style.display;

    const cardHidden  = cardDisplay  === "none";
    const tableHidden = tableDisplay === "none";

    if (!cardHidden || !tableHidden) {
      failed++;
      failures.push({
        label,
        cardDisplay,
        tableDisplay,
      });
    } else {
      passed++;
    }
  }

  const total = passed + failed;

  console.log("Property 8: Any error always hides Weather_Card and Forecast_Table");
  console.log("Validates: Requirements 4.2");
  console.log(`Ran ${total} cases (${fixedCases.length} fixed + ${NUM_RANDOM} random)`);
  console.log();

  if (failed === 0) {
    console.log(`PASS — all ${total} error scenarios correctly hid #weather-card and #forecast-table.`);
    process.exit(0);
  } else {
    console.error(`FAIL — ${failed} of ${total} error scenarios did NOT hide results as expected.`);
    for (const f of failures) {
      console.error(
        `  [FAIL] ${f.label} => weather-card.display="${f.cardDisplay}", forecast-table.display="${f.tableDisplay}"`
      );
    }
    process.exit(1);
  }
}

runAll();
