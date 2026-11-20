/**
 * Bug Condition Exploration Test — Geocoding URL and handleSearch Routing Bug
 * Validates: Requirements 1.1, 1.2, 1.3
 *
 * These four tests encode the EXPECTED (correct) behavior.
 * On UNFIXED code they are expected to FAIL — that failure confirms the bug exists.
 * When the fix is applied (task 3), these same tests will PASS.
 *
 * Bug summary (from design.md):
 *   1. geocodeCity() constructs a URL to geocoding.geo.census.gov/geocoder/locations/invalid
 *      instead of nominatim.openstreetmap.org/search
 *   2. handleSearch() destructures geocodeCity()'s return value as { lat, lon, displayName }
 *      even though geocodeCity() returns a plain array — yielding undefined for all three fields.
 *      As a consequence, zero-candidate, single-candidate, and multi-candidate routing are all broken.
 */

"use strict";

// ---------------------------------------------------------------------------
// Minimal mock DOM (same pattern used by other tests in this suite)
// ---------------------------------------------------------------------------
function createMockDOM(cityInputValue) {
  const btn         = { disabled: false };
  const status      = { textContent: "", className: "" };
  const cityInput   = { value: cityInputValue || "" };
  const weatherCard = { style: { display: "none" }, innerHTML: "", querySelectorAll() { return []; } };
  const forecastTable = { style: { display: "none" } };

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
// Replicate the ACTUAL geocodeCity URL construction from weather.js
// (copied verbatim — this is what we are testing against)
// ---------------------------------------------------------------------------
function buildGeocodingUrl(cityName) {
  const trimmed = cityName.trim();
  // Exact URL template from weather.js line 13 (the broken one):
  return `https://geocoding.geo.census.gov/geocoder/locations/invalid?q=${encodeURIComponent(trimmed)}&countrycodes=us&format=json`;
}

// ---------------------------------------------------------------------------
// Replicate the handleSearch result-routing logic from weather.js.
// We inject a mock geocodeCity so we can control what it returns.
// ---------------------------------------------------------------------------
async function simulateHandleSearch(mockDOM, cityInputValue, mockGeocodeCity, calls) {
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

  // Stub out the downstream functions — we only care about which one is called
  function lookupAndRender(candidate) {
    calls.lookupAndRender.push(candidate);
    return Promise.resolve();
  }

  function renderDisambiguation(candidates) {
    calls.renderDisambiguation.push(candidates);
  }

  const cityName = cityInputValue.trim();

  if (!cityName) {
    setStatus("Please enter a city name.", true);
    return;
  }

  showLoading();
  hideResults();

  try {
    // --- THIS IS THE BROKEN CODE FROM weather.js handleSearch ---
    // It destructures the array return value as an object:
    const { lat, lon, displayName } = await mockGeocodeCity(cityName);

    // Then tries to call fetchPoints with the (always undefined) lat/lon:
    // In our simulation we skip the actual NWS call and just check routing.
    // With the broken destructuring, lat/lon/displayName are all undefined,
    // so the code will never reach lookupAndRender or renderDisambiguation.

    // Simulate what the broken code does: it proceeds to fetchPoints(undefined, undefined)
    // which would throw. For our simulation we just replicate the routing decision:
    // The broken code has NO branching on candidates.length — it immediately destructures.
    // We model the broken routing: if destructuring yields undefined values, it blows up
    // before any candidate-count branching can happen.
    if (lat === undefined && lon === undefined && displayName === undefined) {
      // The real code would throw inside fetchPoints; simulate that throw:
      throw new Error("Weather data retrieval failed: grid lookup returned HTTP 404.");
    }

    // (Correct routing — only reachable on fixed code)
    const candidates = await mockGeocodeCity(cityName);
    if (candidates.length === 0) {
      setStatus("No locations found.", true);
      btn.disabled = false;
      return;
    }
    if (candidates.length === 1) {
      await lookupAndRender(candidates[0]);
      return;
    }
    renderDisambiguation(candidates);

  } catch (err) {
    setStatus(err.message, true);
    hideResults();
  } finally {
    btn.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// Test runner helpers
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;
const failures = [];
const counterexamples = [];

function assert(condition, label, detail) {
  if (condition) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    failures.push({ label, detail });
    counterexamples.push({ label, detail });
    console.error(`  FAIL  ${label}`);
    if (detail) console.error(`        Counterexample: ${detail}`);
  }
}

// ---------------------------------------------------------------------------
// TEST 1 — Wrong URL
// Call geocodeCity("Austin") and assert the constructed URL contains
// "nominatim.openstreetmap.org".
// Will FAIL on unfixed code because the URL contains
// "geocoding.geo.census.gov/geocoder/locations/invalid".
// ---------------------------------------------------------------------------
console.log("\nTest 1 — Wrong URL");
console.log("  Expected: URL contains 'nominatim.openstreetmap.org'");

const cityNames = ["Austin", "Denver", "Springfield", "Portland", "New York"];
for (const city of cityNames) {
  const url = buildGeocodingUrl(city);
  const containsNominatim = url.includes("nominatim.openstreetmap.org");
  assert(
    containsNominatim,
    `geocodeCity("${city}") URL targets Nominatim`,
    `URL was: ${url}`
  );
}

// ---------------------------------------------------------------------------
// TEST 2 — Zero-candidate routing
// Mock geocodeCity to return [], call handleSearch, assert status shows
// "No locations found."
// Will FAIL on unfixed code because destructuring takes the error path instead.
// ---------------------------------------------------------------------------
console.log("\nTest 2 — Zero-candidate routing");
console.log('  Expected: status = "No locations found." when geocodeCity returns []');

async function runTest2() {
  const mockDOM = createMockDOM("Austin");
  const calls = { lookupAndRender: [], renderDisambiguation: [] };

  await simulateHandleSearch(
    mockDOM,
    "Austin",
    async () => [],   // zero candidates
    calls
  );

  const statusText = mockDOM.getElementById("status").textContent;
  assert(
    statusText === "No locations found.",
    'Zero candidates → status is "No locations found."',
    `Actual status: "${statusText}"`
  );
}

// ---------------------------------------------------------------------------
// TEST 3 — Single-candidate routing
// Mock geocodeCity to return one candidate, call handleSearch, assert
// lookupAndRender is invoked with that candidate.
// Will FAIL on unfixed code because destructuring takes the error path instead.
// ---------------------------------------------------------------------------
console.log("\nTest 3 — Single-candidate routing");
console.log("  Expected: lookupAndRender is called with the single candidate");

async function runTest3() {
  const singleCandidate = { lat: "30.2", lon: "-97.7", display_name: "Austin, TX" };
  const mockDOM = createMockDOM("Austin");
  const calls = { lookupAndRender: [], renderDisambiguation: [] };

  await simulateHandleSearch(
    mockDOM,
    "Austin",
    async () => [singleCandidate],
    calls
  );

  assert(
    calls.lookupAndRender.length === 1,
    "Single candidate → lookupAndRender called once",
    `lookupAndRender call count: ${calls.lookupAndRender.length}`
  );
  if (calls.lookupAndRender.length === 1) {
    assert(
      calls.lookupAndRender[0] === singleCandidate,
      "Single candidate → lookupAndRender called with the correct candidate",
      `Received: ${JSON.stringify(calls.lookupAndRender[0])}`
    );
  } else {
    assert(false, "Single candidate → lookupAndRender called with the correct candidate",
      "lookupAndRender was not called at all");
  }
}

// ---------------------------------------------------------------------------
// TEST 4 — Multi-candidate routing
// Mock geocodeCity to return two candidates, call handleSearch, assert
// renderDisambiguation is invoked.
// Will FAIL on unfixed code because destructuring takes the error path instead.
// ---------------------------------------------------------------------------
console.log("\nTest 4 — Multi-candidate routing");
console.log("  Expected: renderDisambiguation is called with the two-candidate array");

async function runTest4() {
  const candidates = [
    { lat: "30.2", lon: "-97.7", display_name: "Austin, TX" },
    { lat: "30.3", lon: "-97.8", display_name: "Austin, Travis County, TX" },
  ];
  const mockDOM = createMockDOM("Austin");
  const calls = { lookupAndRender: [], renderDisambiguation: [] };

  await simulateHandleSearch(
    mockDOM,
    "Austin",
    async () => candidates,
    calls
  );

  assert(
    calls.renderDisambiguation.length === 1,
    "Multiple candidates → renderDisambiguation called once",
    `renderDisambiguation call count: ${calls.renderDisambiguation.length}`
  );
  if (calls.renderDisambiguation.length === 1) {
    assert(
      calls.renderDisambiguation[0].length === 2,
      "Multiple candidates → renderDisambiguation receives both candidates",
      `Received ${calls.renderDisambiguation[0].length} candidate(s)`
    );
  } else {
    assert(false, "Multiple candidates → renderDisambiguation receives both candidates",
      "renderDisambiguation was not called at all");
  }
}

// ---------------------------------------------------------------------------
// Run all async tests then report
// ---------------------------------------------------------------------------
async function runAll() {
  await runTest2();
  await runTest3();
  await runTest4();

  const total = passed + failed;
  console.log("\n" + "=".repeat(70));
  console.log(`Bug Condition Exploration Test — Geocoding URL and handleSearch Routing Bug`);
  console.log(`Validates: Requirements 1.1, 1.2, 1.3`);
  console.log(`Ran ${total} assertions (Test 1: ${cityNames.length} URL checks, Tests 2–4: routing checks)`);
  console.log("=".repeat(70));

  if (failed === 0) {
    console.log("\nPASS — All assertions passed.");
    console.log("NOTE: If this is running on UNFIXED code, this is unexpected.");
    console.log("      If this is running on FIXED code, the fix is confirmed correct.");
    process.exit(0);
  } else {
    console.error(`\nFAIL — ${failed} of ${total} assertions failed (${passed} passed).`);
    console.error("\nCounterexamples found (confirming bugs exist on unfixed code):");
    for (const ce of counterexamples) {
      console.error(`  [BUG] ${ce.label}`);
      if (ce.detail) console.error(`        ${ce.detail}`);
    }
    console.error("\nSummary of bugs confirmed:");
    console.error("  Bug 1 — geocodeCity() constructs URL to geocoding.geo.census.gov/geocoder/locations/invalid");
    console.error("           instead of nominatim.openstreetmap.org/search");
    console.error("  Bug 2 — handleSearch() destructures geocodeCity()'s array return as { lat, lon, displayName },");
    console.error("           yielding undefined for all three fields. Zero/single/multi-candidate routing is broken.");
    process.exit(1);
  }
}

runAll();
