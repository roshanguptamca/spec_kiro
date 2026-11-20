# Implementation Plan: City Disambiguation

## Overview

Modify `weather.js` to return the full Nominatim candidate array from `geocodeCity()`, add a `lookupAndRender()` helper, add `renderDisambiguation()`, and update `handleSearch()` to branch on 0 / 1 / many results. Then create seven property-based test files using fast-check.

## Tasks

- [x] 1. Modify `geocodeCity()` to return the full result array
  - Remove the zero-results `throw` and the destructuring of `results[0]`
  - Replace the return value with `return results || [];`
  - The caller (`handleSearch`) will now own the zero-results error path
  - _Requirements: 1.1, 1.3_

  - [ ] 1.1 Write property test P1 — `geocodeCity` returns full array
    - Create `tests/property-p1-geocode-full-array.js`
    - Mock `fetch` to return an arbitrary `fc.array(fc.record({lat: fc.float(), lon: fc.float(), display_name: fc.string()}))` payload
    - Assert the resolved value equals the full mocked array without truncation
    - Run at minimum 100 iterations
    - **Property 1: `geocodeCity` returns the full candidate array**
    - **Validates: Requirements 1.1**

- [x] 2. Add `lookupAndRender(candidate)` helper
  - Add the function above `handleSearch()` in `weather.js`
  - Call `showLoading()`, then `fetchPoints(candidate.lat, candidate.lon)`
  - Call `Promise.all([fetchCurrentConditions(stationsUrl), fetchForecast(forecastUrl)])`
  - On success: `setStatus("")`, `renderWeatherCard(candidate.display_name, obs)`, `renderForecastTable(periods)`
  - On error: `setStatus(err.message, true)`, `hideResults()`, log `{url, status, message}` to `console.error`
  - In `finally`: re-enable `#search-btn`
  - _Requirements: 2.1, 2.2, 4.1, 4.2, 4.3, 4.4, 5.1_

  - [ ] 2.1 Write property test P6 — `display_name` round-trip
    - Create `tests/property-p6-display-name-roundtrip.js`
    - Mock `fetch` to succeed; generate arbitrary `fc.record({lat: fc.string(), lon: fc.string(), display_name: fc.string()})` candidates
    - After `lookupAndRender` resolves, assert `document.getElementById("result-city").textContent === candidate.display_name`
    - **Property 6: `display_name` round-trip to Weather_Card**
    - **Validates: Requirements 2.2, 4.3**

  - [ ] 2.2 Write property test P7 — Search_Button always re-enabled
    - Create `tests/property-p7-button-reenabled.js`
    - Drive `handleSearch()` with `fc.oneof(fc.constant([]), fc.array(fc.record({lat: fc.string(), lon: fc.string(), display_name: fc.string()}), {minLength: 1}))` as the mocked geocoder return value
    - After `handleSearch()` settles (both success and mocked-error paths), assert `document.getElementById("search-btn").disabled === false`
    - **Property 7: Search_Button is always re-enabled after `handleSearch` settles**
    - **Validates: Requirements 5.1**

- [x] 3. Add `renderDisambiguation(candidates)` function
  - Add the function above `handleSearch()` in `weather.js`
  - Slice `candidates` to at most 10
  - Build one `<button>` per candidate showing `candidate.display_name`; attach a click handler that calls `lookupAndRender(candidate)`
  - Set `#weather-card innerHTML` to the built fragment; set `#weather-card style.display = "block"`
  - Set `#forecast-table style.display = "none"`
  - Re-enable `#search-btn`
  - Call `setStatus("Multiple locations found. Please select one:")`
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 3.1 Write property test P2 — disambiguation UI invariants
    - Create `tests/property-p2-disambig-ui-invariants.js`
    - Generate `fc.array(..., {minLength: 2})` candidate arrays; call `renderDisambiguation(candidates)`
    - Assert `#weather-card` is visible, `#forecast-table` is hidden, `#search-btn.disabled === false`
    - **Property 2: Disambiguation UI invariants**
    - **Validates: Requirements 3.1, 3.4, 3.5**

  - [ ]* 3.2 Write property test P3 — button count equals `min(N, 10)`
    - Create `tests/property-p3-button-count.js`
    - Generate `fc.array(..., {minLength: 1, maxLength: 15})` candidate arrays; call `renderDisambiguation(candidates)`
    - Assert the number of `<button>` elements inside `#weather-card` equals `Math.min(candidates.length, 10)`
    - **Property 3: Button count equals `min(candidates.length, 10)`**
    - **Validates: Requirements 3.2**

  - [ ]* 3.3 Write property test P4 — status message is the fixed string
    - Create `tests/property-p4-status-message.js`
    - Generate `fc.array(..., {minLength: 2})` candidate arrays; call `renderDisambiguation(candidates)`
    - Assert `document.getElementById("status").textContent === "Multiple locations found. Please select one:"`
    - **Property 4: Disambiguation status message is always the fixed string**
    - **Validates: Requirements 3.3**

- [ ] 4. Checkpoint — Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Modify `handleSearch()` to branch on candidate count
  - Remove the `const { lat, lon, displayName } = await geocodeCity(cityName)` line and the existing try/catch NWS call block
  - Call `const candidates = await geocodeCity(cityName)` (now returns array)
  - Add branch: `if (candidates.length === 0)` → `setStatus("City not found. Please try a valid US city name.", true)`, re-enable button, return
  - Add branch: `else if (candidates.length === 1)` → `await lookupAndRender(candidates[0])`
  - Add branch: `else` → `renderDisambiguation(candidates)`
  - Remove the outer `finally` that re-enables the button (now owned by `lookupAndRender` and `renderDisambiguation`)
  - Keep the `hideResults()` and `setStatus("")` calls at the top of `handleSearch()` so a new search while disambiguation is visible clears the card
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 3.1, 5.2_

  - [ ]* 5.1 Write property test P5 — selection uses correct coordinates
    - Create `tests/property-p5-selection-coords.js`
    - Generate `fc.array(..., {minLength: 2, maxLength: 10})` plus `fc.nat({max: 9})` for the button index; call `renderDisambiguation(candidates)`, then programmatically click button at that index
    - Capture the `lat`/`lon` passed to the mocked `fetch` for the NWS `/points/` call; assert they equal `candidates[index].lat` and `candidates[index].lon`
    - Assert `#search-btn.disabled === true` and `#status` shows the loading message at the moment the NWS request begins
    - **Property 5: Candidate selection uses the correct coordinates and transitions to loading**
    - **Validates: Requirements 4.1, 4.2**

- [ ] 6. Final checkpoint — Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests use fast-check and run in Node.js with minimal DOM mocking (same pattern as existing `tests/` files)
- `lookupAndRender` owns button re-enable for the 0-result and 1-result paths; `renderDisambiguation` owns it for the many-results path
- No new HTML structure changes are needed — `renderDisambiguation` writes directly into `#weather-card innerHTML`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "2.2"] },
    { "id": 2, "tasks": ["3.1", "3.2", "3.3"] },
    { "id": 3, "tasks": ["5.1"] }
  ]
}
```
