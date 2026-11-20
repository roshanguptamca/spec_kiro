# Implementation Plan

## Overview

Fix `geocodeCity` to target the correct Nominatim endpoint and rewrite `handleSearch` to route the candidates array through the existing disambiguation flow.

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1", "2"] },
    { "wave": 2, "tasks": ["3"] },
    { "wave": 3, "tasks": ["4"] }
  ]
}
```

## Tasks

- [-] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Geocoding URL and handleSearch Routing Bug
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to the concrete failing cases: any non-empty city name string triggers both defects
  - Test 1 - Wrong URL: Call `geocodeCity("Austin")` and assert the constructed URL contains `nominatim.openstreetmap.org` — will FAIL on unfixed code (URL contains `geocoding.geo.census.gov/geocoder/locations/invalid`)
  - Test 2 - Zero-candidate routing: Mock `geocodeCity` to return `[]`, call `handleSearch`, assert status shows "No locations found." — will FAIL on unfixed code (destructuring path taken instead)
  - Test 3 - Single-candidate routing: Mock `geocodeCity` to return one candidate `[{lat:"30.2",lon:"-97.7",display_name:"Austin, TX"}]`, call `handleSearch`, assert `lookupAndRender` is invoked — will FAIL on unfixed code
  - Test 4 - Multi-candidate routing: Mock `geocodeCity` to return two candidates, call `handleSearch`, assert `renderDisambiguation` is invoked — will FAIL on unfixed code
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (this is correct - it proves the bug exists)
  - Document counterexamples found: `geocodeCity` constructs Census URL; `handleSearch` destructures array as object yielding `undefined` lat/lon/displayName
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Geocoding Behavior Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: `handleSearch` with empty input shows "Please enter a city name." without any network calls on unfixed code — this path is unaffected by the broken URL
  - Observe: `renderDisambiguation` button-click → `lookupAndRender` path works correctly on unfixed code (those functions are correct)
  - Observe: When `fetchPoints` throws, `setStatus` is called with the error message and results are hidden
  - Write property-based test: for all whitespace-only and empty city name strings, `handleSearch` shows "Please enter a city name." and makes zero network calls (from Preservation Requirements 3.5 in design)
  - Write property-based test: for any array of 2–10 mock candidates passed to `renderDisambiguation`, each button click invokes `lookupAndRender` with the correct candidate (Preservation Requirements 3.1, 3.2)
  - Verify tests PASS on UNFIXED code before proceeding to implementation
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 3. Fix geocoding URL and handleSearch result routing

  - [~] 3.1 Fix `geocodeCity` URL and add User-Agent header
    - In `weather.js`, replace the URL template in `geocodeCity` (line ~13):
      - Change `https://geocoding.geo.census.gov/geocoder/locations/invalid?q=...` to `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(trimmed)}&countrycodes=us&format=json`
    - Add `User-Agent` header to the `fetch` call inside `geocodeCity`:
      - `const res = await fetch(url, { headers: { "User-Agent": "USWeatherApp/1.0 (educational project; contact@example.com)" } });`
    - _Bug_Condition: isBugCondition(input) — input.trim() != "" AND URL contains "geocoding.geo.census.gov/geocoder/locations/invalid"_
    - _Expected_Behavior: geocodeCity returns a valid array of objects each containing lat, lon, and display_name; URL contains "nominatim.openstreetmap.org"_
    - _Preservation: geocodeCity return type (array) and downstream callers (handleSearch) are unchanged in contract_
    - _Requirements: 2.1_

  - [~] 3.2 Fix `handleSearch` result routing
    - In `weather.js`, replace the broken destructuring block in `handleSearch` inside the `try` block:
      - Remove: `const { lat, lon, displayName } = await geocodeCity(cityName);` and all subsequent inline NWS calls
      - Replace with:
        ```js
        const candidates = await geocodeCity(cityName);
        if (candidates.length === 0) {
          setStatus("No locations found.", true);
          document.getElementById("search-btn").disabled = false;
          return;
        }
        if (candidates.length === 1) {
          await lookupAndRender(candidates[0]);
          return;
        }
        renderDisambiguation(candidates);
        ```
    - The existing `try/catch/finally` wrapper remains to handle geocoding network errors; NWS calls are handled inside `lookupAndRender`
    - _Bug_Condition: handleSearch destructures geocodeCity return as { lat, lon, displayName } instead of treating it as an array_
    - _Expected_Behavior: 0 candidates → "No locations found." status; 1 candidate → lookupAndRender(candidates[0]); 2+ candidates → renderDisambiguation(candidates)_
    - _Preservation: renderDisambiguation, lookupAndRender, renderWeatherCard, renderForecastTable, NWS error handling, empty-input guard all remain unchanged_
    - _Requirements: 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4_

  - [~] 3.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Geocoding URL and handleSearch Routing Bug
    - **IMPORTANT**: Re-run the SAME tests from task 1 - do NOT write new tests
    - The tests from task 1 encode the expected behavior
    - When these tests pass, they confirm the expected behavior is satisfied
    - Re-run all four test cases from step 1
    - **EXPECTED OUTCOME**: All four tests PASS (confirms both defects are fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [~] 3.4 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Geocoding Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run all preservation property tests from step 2
    - **EXPECTED OUTCOME**: All preservation tests PASS (confirms no regressions)
    - Confirm empty-input guard, disambiguation button flow, and NWS error handling are all unchanged

- [~] 4. Checkpoint - Ensure all tests pass
  - Re-run the full test suite (exploration tests from task 1 and preservation tests from task 2)
  - All tests must pass; if any fail, revisit the corresponding fix step before proceeding
  - Ensure ask the user if questions arise

## Notes

- Run exploration tests (task 1) on the **unfixed** code first — failures confirm the bugs exist.
- Run preservation tests (task 2) on the **unfixed** code — passes establish the baseline to protect.
- Only then apply the fix (task 3) and re-run both test sets to confirm fix-checking and preservation-checking both pass.
- Both changes are isolated to `weather.js`: the URL template in `geocodeCity` and the result-routing block in `handleSearch`.
