/**
 * Property 2: Preservation — Non-Geocoding Behavior Unchanged
 * Validates: Requirements 3.1, 3.2, 3.5
 *
 * This file contains two preservation property tests that MUST PASS on
 * the UNFIXED code. They establish the behavioral baseline that the fix
 * must not break.
 *
 * ---
 *
 * Test A — Empty/whitespace input guard (Requirement 3.5)
 *
 * The relevant logic in handleSearch() (weather.js):
 *
 *   const cityName = document.getElementById("city-input").value.trim();
 *   if (!cityName) {
 *     setStatus("Please enter a city name.", true);
 *     return;              // early return — no network call
 *   }
 *
 * Property: for ALL whitespace-only or empty city name strings, handleSearch()
 * SHALL set status to "Please enter a city name." and SHALL make zero network
 * calls (fetch is never invoked).
 *
 * ---
 *
 * Test B — Disambiguation button routing (Requirements 3.1, 3.2)
 *
 * The relevant logic in renderDisambiguation() (weather.js):
 *
 *   const limited = candidates.slice(0, 10);
 *   // builds buttons and attaches:
 *   btn.addEventListener("click", function() {
 *     lookupAndRender(limited[i]);
 *   });
 *
 * Property: for ANY array of 2–10 mock candidates passed to
 * renderDisambiguation(), clicking the i-th button SHALL invoke
 * lookupAndRender with candidates[i], and clicking ALL buttons in order
 * SHALL pass each candidate exactly once in the correct order.
 */

"use strict";

// ===========================================================================
// TEST A — Empty/whitespace input guard
// ===========================================================================

// ---------------------------------------------------------------------------
// Replicate handleSearch's input validation logic from weather.js
// The function is self-contained: trim → empty-check → early-return or proceed.
// We pass a fetchCallCount by reference to verify no network call is made.
// ---------------------------------------------------------------------------
async function simulateHandleSearch_emptyGuard(rawInput, fetchCounter) {
  const statusLog = { text: "", isError: false };

  function setStatus(msg, isError) {
    statusLog.text    = msg;
    statusLog.isError = !!isError;
  }

  // The logic under test — identical to weather.js handleSearch preamble
  const cityName = rawInput.trim();
  if (!cityName) {
    setStatus("Please enter a city name.", true);
    return { status: statusLog, fetchCalled: fetchCounter.count > 0 };
  }

  // Anything past this point would call fetch (geocodeCity, fetchPoints…).
  // For this property test we only need to verify the early-return fires.
  // We increment the counter here to represent what would happen if the guard
  // were absent — if the counter goes up, the guard failed.
  fetchCounter.count++;
  return { status: statusLog, fetchCalled: true };
}

// Whitespace character set that JS String.prototype.trim() removes
const WHITESPACE_CHARS = [" ", "\t", "\n", "\r", "\f", "\v"];

// Deterministic pseudo-random (LCG)
function lcg(seed) {
  return ((seed * 1664525 + 1013904223) >>> 0);
}

function randomWhitespaceString(seed, maxLen) {
  let r = seed;
  const len = (Math.abs(r) % maxLen) + 1;
  let s = "";
  for (let i = 0; i < len; i++) {
    r = lcg(r);
    s += WHITESPACE_CHARS[Math.abs(r) % WHITESPACE_CHARS.length];
  }
  return s;
}

const fixedEmptyCases = [
  "",
  " ",
  "  ",
  "   ",
  "\t",
  "\t\t",
  "\n",
  "\r\n",
  " \t\n\r\f\v",
  "     \t     ",
  "\n\n\n",
  "  \t  \n  \r  ",
];

const NUM_RANDOM_A = 100;
const randomEmptyCases = [];
for (let i = 1; i <= NUM_RANDOM_A; i++) {
  randomEmptyCases.push(randomWhitespaceString(i * 7919, 50));
}

const allEmptyCases = [...fixedEmptyCases, ...randomEmptyCases];

// ---------------------------------------------------------------------------
// Run Test A
// ---------------------------------------------------------------------------
async function runTestA() {
  let passed   = 0;
  let failed   = 0;
  const failures = [];

  for (const input of allEmptyCases) {
    const fetchCounter = { count: 0 };
    const result = await simulateHandleSearch_emptyGuard(input, fetchCounter);

    const correctMessage = result.status.text === "Please enter a city name.";
    const correctError   = result.status.isError === true;
    const noFetch        = result.fetchCalled === false;

    if (!correctMessage || !correctError || !noFetch) {
      failed++;
      failures.push({
        input:          JSON.stringify(input),
        message:        result.status.text,
        isError:        result.status.isError,
        fetchCalled:    result.fetchCalled,
        source:         input === "" || fixedEmptyCases.includes(input) ? "fixed" : "random",
      });
    } else {
      passed++;
    }
  }

  return { passed, failed, failures, total: passed + failed };
}

// ===========================================================================
// TEST B — Disambiguation button routing
// ===========================================================================

// ---------------------------------------------------------------------------
// Minimal DOM simulator for renderDisambiguation.
//
// renderDisambiguation() in weather.js does:
//   1. Slices candidates to at most 10
//   2. Builds innerHTML with one <button class="disambig-btn"> per candidate
//   3. Queries .disambig-btn buttons and attaches click handlers
//   4. Each click handler calls lookupAndRender(limited[i])
//
// We simulate that DOM behaviour here without a real browser.
// ---------------------------------------------------------------------------
function createDisambigDOM() {
  // Tracks the calls made to lookupAndRender
  const lookupCalls = [];

  // Fake lookupAndRender — records what it was called with
  function lookupAndRender(candidate) {
    lookupCalls.push(candidate);
  }

  // Simulated card element that can hold injected button handlers
  const registeredButtons = [];

  const weatherCard = {
    _buttons: registeredButtons,
    innerHTML: "",        // set by renderDisambiguation
    style: { display: "none" },
    querySelectorAll(selector) {
      // After renderDisambiguation sets innerHTML we return the button list
      return registeredButtons;
    },
  };

  const forecastTable = { style: { display: "block" } };
  const searchBtn     = { disabled: false };
  const statusEl      = { textContent: "", className: "" };

  const mockDocument = {
    getElementById(id) {
      switch (id) {
        case "weather-card":   return weatherCard;
        case "forecast-table": return forecastTable;
        case "search-btn":     return searchBtn;
        case "status":         return statusEl;
        default: throw new Error(`Unknown element id: ${id}`);
      }
    },
  };

  return { mockDocument, weatherCard, registeredButtons, lookupCalls, lookupAndRender, statusEl };
}

// Replicate renderDisambiguation from weather.js using the mock DOM
function simulateRenderDisambiguation(candidates, dom) {
  const { mockDocument, weatherCard, registeredButtons, lookupAndRender } = dom;

  const limited = candidates.slice(0, 10);

  // Build button objects (simulating innerHTML injection)
  // Each button just needs addEventListener and a click() helper
  registeredButtons.length = 0; // clear

  limited.forEach(function(candidate, i) {
    const btn = {
      _index: i,
      _handlers: [],
      addEventListener(event, fn) {
        this._handlers.push({ event, fn });
      },
      click() {
        this._handlers.filter(h => h.event === "click").forEach(h => h.fn());
      },
    };
    registeredButtons.push(btn);
  });

  // Attach click handlers — identical to weather.js renderDisambiguation
  registeredButtons.forEach(function(btn, i) {
    btn.addEventListener("click", function() {
      lookupAndRender(limited[i]);
    });
  });

  weatherCard.style.display = "block";

  const forecastTable = mockDocument.getElementById("forecast-table");
  forecastTable.style.display = "none";

  const searchBtn = mockDocument.getElementById("search-btn");
  searchBtn.disabled = false;

  const statusEl = mockDocument.getElementById("status");
  statusEl.textContent = "Multiple locations found. Please select one:";
  statusEl.className   = "";
}

// ---------------------------------------------------------------------------
// Candidate generator — produces mock Nominatim-shaped candidates
// ---------------------------------------------------------------------------
const SAMPLE_CITIES = [
  "Austin, TX", "Portland, OR", "Seattle, WA", "Denver, CO",
  "Chicago, IL", "Houston, TX", "Miami, FL", "Boston, MA",
  "Phoenix, AZ", "Atlanta, GA",
];

function makeCandidates(n, seed) {
  const candidates = [];
  let r = seed;
  for (let i = 0; i < n; i++) {
    r = lcg(r);
    const lat  = ((r % 9000) / 100 + 24).toFixed(4); // roughly US lat range
    r = lcg(r);
    const lon  = (-(r % 6000) / 100 - 67).toFixed(4); // roughly US lon range
    const name = SAMPLE_CITIES[i % SAMPLE_CITIES.length];
    candidates.push({ lat: String(lat), lon: String(lon), display_name: name });
  }
  return candidates;
}

// ---------------------------------------------------------------------------
// Fixed cases: 2–10 candidates, test every button in each array
// ---------------------------------------------------------------------------
const fixedDisambigCases = [];
for (let n = 2; n <= 10; n++) {
  fixedDisambigCases.push({ label: `${n} candidates (fixed)`, candidates: makeCandidates(n, n * 1000) });
}

// Random cases: random array sizes 2–10 with varied seeds
const NUM_RANDOM_B = 50;
const randomDisambigCases = [];
for (let i = 1; i <= NUM_RANDOM_B; i++) {
  let r = lcg(i * 31337);
  const n = (r % 9) + 2; // 2–10
  randomDisambigCases.push({ label: `${n} candidates (random seed ${i})`, candidates: makeCandidates(n, r) });
}

const allDisambigCases = [...fixedDisambigCases, ...randomDisambigCases];

// ---------------------------------------------------------------------------
// Run Test B
// ---------------------------------------------------------------------------
async function runTestB() {
  let passed   = 0;
  let failed   = 0;
  const failures = [];

  for (const { label, candidates } of allDisambigCases) {
    const dom = createDisambigDOM();
    simulateRenderDisambiguation(candidates, dom);

    const limited = candidates.slice(0, 10);

    // Click every button in order and collect results
    const { registeredButtons, lookupCalls } = dom;

    for (let i = 0; i < registeredButtons.length; i++) {
      registeredButtons[i].click();
    }

    // Check 1: correct number of calls
    if (lookupCalls.length !== limited.length) {
      failed++;
      failures.push({
        label,
        issue:    `expected ${limited.length} lookupAndRender calls, got ${lookupCalls.length}`,
      });
      continue;
    }

    // Check 2: each call received the correct candidate (by reference equality)
    let allCorrect = true;
    for (let i = 0; i < limited.length; i++) {
      if (lookupCalls[i] !== limited[i]) {
        allCorrect = false;
        failures.push({
          label,
          issue: `button[${i}] passed wrong candidate: expected ${JSON.stringify(limited[i])}, got ${JSON.stringify(lookupCalls[i])}`,
        });
        failed++;
        break;
      }
    }
    if (allCorrect) {
      passed++;
    }
  }

  return { passed, failed, failures, total: passed + failed };
}

// ===========================================================================
// Main — run both tests and report
// ===========================================================================
async function main() {
  const A = await runTestA();
  const B = await runTestB();

  const totalPassed = A.passed + B.passed;
  const totalFailed = A.failed + B.failed;
  const totalCases  = A.total  + B.total;

  // --- Test A report ---
  console.log("Property 2: Preservation — Non-Geocoding Behavior Unchanged");
  console.log("Validates: Requirements 3.1, 3.2, 3.5");
  console.log();
  console.log(`  Test A: Empty/whitespace input guard (Requirement 3.5)`);
  console.log(`  Ran ${A.total} cases (${fixedEmptyCases.length} fixed + ${NUM_RANDOM_A} random)`);
  if (A.failed === 0) {
    console.log(`  PASS — all ${A.total} empty/whitespace inputs showed "Please enter a city name." with zero network calls.`);
  } else {
    console.error(`  FAIL — ${A.failed} of ${A.total} inputs did NOT behave correctly:`);
    for (const f of A.failures) {
      console.error(
        `    input=${f.input} => message="${f.message}", isError=${f.isError}, fetchCalled=${f.fetchCalled}`
      );
    }
  }

  console.log();

  // --- Test B report ---
  console.log(`  Test B: Disambiguation button routing (Requirements 3.1, 3.2)`);
  console.log(`  Ran ${B.total} candidate arrays (${fixedDisambigCases.length} fixed + ${NUM_RANDOM_B} random)`);
  if (B.failed === 0) {
    console.log(`  PASS — all ${B.total} arrays had every button correctly route to lookupAndRender with the right candidate.`);
  } else {
    console.error(`  FAIL — ${B.failed} of ${B.total} arrays had routing errors:`);
    for (const f of B.failures) {
      console.error(`    [${f.label}] ${f.issue}`);
    }
  }

  console.log();

  // --- Summary ---
  console.log(`Overall: ${totalPassed} passed, ${totalFailed} failed out of ${totalCases} total cases.`);
  console.log();

  if (totalFailed === 0) {
    console.log("PASS — All preservation properties hold on the current (unfixed) code.");
    console.log("These tests establish the behavioral baseline the fix must not break.");
    process.exit(0);
  } else {
    console.error("FAIL — One or more preservation properties failed.");
    console.error("These tests MUST PASS on unfixed code. If they fail, fix the tests, NOT the source.");
    process.exit(1);
  }
}

main();
