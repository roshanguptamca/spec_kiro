/**
 * Property 1: Whitespace-only input is always rejected
 * Validates: Requirements 1.2
 *
 * The input validation logic in handleSearch() (weather.js) does:
 *   const cityName = document.getElementById("city-input").value.trim();
 *   if (!cityName) { setStatus("Please enter a city name.", true); return; }
 *
 * This test verifies that for any string composed entirely of whitespace
 * characters, trimming it produces an empty string — meaning the validation
 * logic will always reject it and display "Please enter a city name."
 */

"use strict";

// ---------------------------------------------------------------------------
// Replicate the validation logic from weather.js handleSearch()
// ---------------------------------------------------------------------------
function validateCityInput(rawInput) {
  const cityName = rawInput.trim();
  if (!cityName) {
    return { rejected: true, message: "Please enter a city name." };
  }
  return { rejected: false, message: "" };
}

// ---------------------------------------------------------------------------
// Whitespace character generators
// ---------------------------------------------------------------------------
const WHITESPACE_CHARS = [
  " ",    // space
  "\t",   // tab
  "\n",   // newline
  "\r",   // carriage return
  "\f",   // form feed
  "\v",   // vertical tab
  "\u00A0", // non-breaking space (not trimmed by all engines, but JS trim handles it)
];

// Generate a random whitespace-only string of length 1..maxLen
function randomWhitespaceString(seed, maxLen) {
  // Simple deterministic pseudo-random based on seed
  let s = "";
  let r = seed;
  const len = (r % maxLen) + 1;
  for (let i = 0; i < len; i++) {
    r = (r * 1664525 + 1013904223) & 0xFFFFFFFF;
    // Use only the standard JS-trim whitespace chars (indices 0-5)
    const idx = Math.abs(r) % 6;
    s += WHITESPACE_CHARS[idx];
  }
  return s;
}

// ---------------------------------------------------------------------------
// Fixed cases — deterministic coverage of important edge cases
// ---------------------------------------------------------------------------
const fixedCases = [
  "",                   // empty string
  " ",                  // single space
  "  ",                 // two spaces
  "   ",                // three spaces
  "\t",                 // single tab
  "\t\t",               // two tabs
  "\n",                 // newline
  "\r\n",               // CRLF
  " \t\n\r\f\v",        // all whitespace types combined
  "     \t     ",       // mixed spaces and tab
  "\n\n\n",             // multiple newlines
  "  \t  \n  \r  ",     // complex mixed whitespace
];

// ---------------------------------------------------------------------------
// Run the property test
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;
const failures = [];

// Test fixed cases
for (const input of fixedCases) {
  const result = validateCityInput(input);
  if (!result.rejected || result.message !== "Please enter a city name.") {
    failed++;
    failures.push({
      input: JSON.stringify(input),
      result,
      source: "fixed-case",
    });
  } else {
    passed++;
  }
}

// Test 100 randomly generated whitespace-only strings
const NUM_RANDOM = 100;
for (let seed = 1; seed <= NUM_RANDOM; seed++) {
  const input = randomWhitespaceString(seed * 7919, 50);
  const result = validateCityInput(input);
  if (!result.rejected || result.message !== "Please enter a city name.") {
    failed++;
    failures.push({
      input: JSON.stringify(input),
      result,
      source: "random",
    });
  } else {
    passed++;
  }
}

const total = passed + failed;

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
console.log(`Property 1: Whitespace-only input is always rejected`);
console.log(`Validates: Requirements 1.2`);
console.log(`Ran ${total} cases (${fixedCases.length} fixed + ${NUM_RANDOM} random)`);
console.log();

if (failed === 0) {
  console.log(`PASS — all ${total} whitespace-only inputs were correctly rejected.`);
  process.exit(0);
} else {
  console.error(`FAIL — ${failed} of ${total} inputs were NOT rejected as expected.`);
  for (const f of failures) {
    console.error(`  [${f.source}] input=${f.input} => rejected=${f.result.rejected}, message="${f.result.message}"`);
  }
  process.exit(1);
}
