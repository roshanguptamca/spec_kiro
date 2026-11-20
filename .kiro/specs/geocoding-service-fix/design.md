# Geocoding Service Fix - Bugfix Design

## Overview

`geocodeCity` in `weather.js` has two defects that together prevent any city search from working:

1. The URL targets `geocoding.geo.census.gov/geocoder/locations/invalid`, a non-existent endpoint, causing every request to fail with a network or HTTP error.
2. `handleSearch` destructures the return value as `{ lat, lon, displayName }`, but `geocodeCity` returns a raw array of candidates, so all three fields are always `undefined`.

The fix replaces the broken URL with the correct Nominatim endpoint and rewrites `handleSearch` to route the candidates array through the existing disambiguation flow (`renderDisambiguation`, `lookupAndRender`) rather than attempting to destructure a single object.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — a city search is submitted, causing `geocodeCity` to be called with a non-empty city name string.
- **Property (P)**: The desired behavior when the bug condition holds — `geocodeCity` returns a valid array of Nominatim candidates and `handleSearch` routes them correctly.
- **Preservation**: The existing behaviors that must remain unchanged by the fix — disambiguation rendering, candidate selection, weather card rendering, error handling, and empty-input validation.
- **`geocodeCity(cityName)`**: The function in `weather.js` that constructs the geocoding URL and returns candidate results.
- **`handleSearch()`**: The main entry-point function in `weather.js` that reads the city input, calls `geocodeCity`, and routes results to the UI.
- **`renderDisambiguation(candidates)`**: Renders a button list when multiple candidates are returned, awaiting user selection.
- **`lookupAndRender(candidate)`**: Fetches NWS weather data and renders the weather card and forecast table for a single `{ lat, lon, display_name }` candidate.
- **Nominatim candidate**: An object returned by the Nominatim API with at minimum `lat`, `lon`, and `display_name` string fields.

## Bug Details

### Bug Condition

The bug manifests whenever a user submits any non-empty city name. `geocodeCity` constructs a URL to a non-existent Census endpoint, so the fetch either throws a network error or returns an unexpected payload. Even if the fetch somehow succeeded, `handleSearch` destructures the return value as `{ lat, lon, displayName }` — fields that do not exist on the array — producing `undefined` coordinates that break the downstream NWS call.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type string (city name)
  OUTPUT: boolean

  RETURN input.trim() != ""
         AND geocodeCityURL(input) CONTAINS "geocoding.geo.census.gov/geocoder/locations/invalid"
END FUNCTION
```

### Examples

- User searches "Austin" → URL constructed is `geocoding.geo.census.gov/geocoder/locations/invalid?q=Austin…` → HTTP error → "Location lookup failed: network error." displayed; no weather data loaded.
- User searches "Springfield" → Even if a mock makes `geocodeCity` return `[{lat, lon, display_name}]`, `handleSearch` destructures it as `{ lat, lon, displayName }` → all three are `undefined` → `fetchPoints(undefined, undefined)` constructs `api.weather.gov/points/undefined,undefined` → HTTP error.
- User searches "Portland" with two results → Same destructuring issue; disambiguation flow is never reached.
- User searches "" → Bug condition does NOT hold (empty input guard fires first); "Please enter a city name." is shown correctly.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `renderDisambiguation` and its button-click handlers that call `lookupAndRender` must continue to work exactly as written.
- `lookupAndRender` must continue to accept `{ lat, lon, display_name }` and fetch/render weather data unchanged.
- `renderWeatherCard` and `renderForecastTable` must remain untouched.
- NWS error handling in `lookupAndRender` (network errors, HTTP failures) must remain unchanged.
- Empty-input guard in `handleSearch` ("Please enter a city name.") must remain unchanged.

**Scope:**
All code paths that do NOT involve the geocoding URL construction or the `handleSearch` result-routing logic are unaffected. This includes:
- Mouse clicks on disambiguation buttons.
- Unit toggle (°F / °C) behavior.
- Forecast table rendering.
- Any NWS-side network errors after valid coordinates are obtained.

## Hypothesized Root Cause

Based on the source code in `weather.js`:

1. **Wrong geocoding endpoint**: The URL template on line 13 hard-codes `geocoding.geo.census.gov/geocoder/locations/invalid` instead of `nominatim.openstreetmap.org/search`. The comment at the top of the file correctly names Nominatim as the intended service, confirming this is a coding error, not a design change.

2. **Incorrect destructuring in `handleSearch`**: Line ~170 uses `const { lat, lon, displayName } = await geocodeCity(cityName)`. Nominatim returns an array, not an object; and even if it were an object the field would be `display_name`, not `displayName`. The correct approach is to treat the return value as an array and pass it to the existing `renderDisambiguation` / `lookupAndRender` routing logic.

3. **Missing zero-candidate and single-candidate handling**: `handleSearch` has no branches for 0 or 1 candidate — it immediately tries to destructure — so those cases are also broken even if the URL were correct.

## Correctness Properties

Property 1: Bug Condition - Geocoding Sends Request to Nominatim and Returns Candidates

_For any_ non-empty city name string where `isBugCondition` returns true (i.e., the current broken URL is in use), the fixed `geocodeCity` function SHALL construct a URL to `nominatim.openstreetmap.org/search` with `q`, `countrycodes=us`, and `format=json` parameters, and SHALL return a valid array (possibly empty) of objects each containing `lat`, `lon`, and `display_name`.

**Validates: Requirements 2.1**

Property 2: Preservation - Non-Geocoding Behavior Unchanged

_For any_ input path where `isBugCondition` does NOT hold (empty city input guard, disambiguation button clicks, NWS fetch calls, unit toggle), the fixed code SHALL produce exactly the same behavior as the original code, preserving all existing functionality unrelated to geocoding URL construction and `handleSearch` result routing.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

Assuming the root cause analysis is correct, only two locations in `weather.js` need changes.

**File**: `weather.js`

**Change 1 — Fix `geocodeCity` URL**

**Function**: `geocodeCity`

Replace the Census endpoint URL with the correct Nominatim URL:

```
// Before
const url = `https://geocoding.geo.census.gov/geocoder/locations/invalid?q=...`

// After
const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(trimmed)}&countrycodes=us&format=json`;
```

Add the required Nominatim `User-Agent` header to the fetch call (Nominatim's usage policy requires a descriptive User-Agent):

```
const res = await fetch(url, {
  headers: { "User-Agent": "USWeatherApp/1.0 (educational project; contact@example.com)" }
});
```

**Change 2 — Fix `handleSearch` result routing**

**Function**: `handleSearch`

Replace the destructuring assignment and inline NWS calls with the correct candidate-routing logic:

```
// Before (broken)
const { lat, lon, displayName } = await geocodeCity(cityName);
const { stationsUrl, forecastUrl } = await fetchPoints(lat, lon);
...

// After (correct)
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

The `try/catch/finally` wrapper in `handleSearch` can remain to handle geocoding network errors; the NWS-call block it previously contained moves entirely to `lookupAndRender` (which already handles it).

## Testing Strategy

### Validation Approach

Testing follows a two-phase approach: first run exploratory tests against the unfixed code to surface counterexamples and confirm the root cause, then verify the fix passes fix-checking and preservation-checking tests.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples demonstrating the bug on the unfixed code. Confirm or refute the root cause analysis.

**Test Plan**: Mock `fetch` to return a valid Nominatim-shaped response, then call `geocodeCity` and `handleSearch` and assert the expected routing occurs. On the unfixed code these assertions will fail, revealing exactly which part of the chain is broken.

**Test Cases**:
1. **Wrong URL test**: Call `geocodeCity("Austin")` and assert the constructed URL contains `nominatim.openstreetmap.org` — will fail on unfixed code (URL contains Census endpoint).
2. **Multi-candidate routing test**: Mock `geocodeCity` to return two candidates, call `handleSearch`, assert `renderDisambiguation` is invoked — will fail on unfixed code (destructuring path taken instead).
3. **Single-candidate routing test**: Mock `geocodeCity` to return one candidate, call `handleSearch`, assert `lookupAndRender` is invoked — will fail on unfixed code.
4. **Zero-candidate test**: Mock `geocodeCity` to return `[]`, call `handleSearch`, assert "No locations found." status is set — will fail on unfixed code.

**Expected Counterexamples**:
- `geocodeCity` constructs a URL to `geocoding.geo.census.gov` instead of `nominatim.openstreetmap.org`.
- `handleSearch` attempts object destructuring on an array, yielding `undefined` for `lat`, `lon`, and `displayName`.

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL cityName WHERE isBugCondition(cityName) DO
  candidates := geocodeCity_fixed(cityName)
  ASSERT URL contained "nominatim.openstreetmap.org"
  ASSERT candidates is an array
  IF candidates.length > 1 THEN ASSERT renderDisambiguation was called
  IF candidates.length = 1 THEN ASSERT lookupAndRender was called with candidates[0]
  IF candidates.length = 0 THEN ASSERT status shows "No locations found."
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed code behaves identically to the original.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT handleSearch_original(input) = handleSearch_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many input variations automatically (empty strings, whitespace-only strings, various non-geocoding interaction paths).
- It catches regressions in edge cases that manual tests miss.
- It provides strong guarantees that unrelated behaviors are unchanged across the full input domain.

**Test Cases**:
1. **Empty input preservation**: Verify "Please enter a city name." fires without network calls — both before and after fix.
2. **Disambiguation button preservation**: Observe `renderDisambiguation` button-click → `lookupAndRender` path works on unfixed code (it does, since those functions are correct), then assert it still works after the fix.
3. **NWS error handling preservation**: Verify that when `fetchPoints` throws, `setStatus` is called with the error message and results are hidden — unchanged by the fix.
4. **Unit toggle preservation**: Verify the °F/°C toggle applies correctly after a successful render — unchanged by the fix.

### Unit Tests

- Test that `geocodeCity` constructs the correct Nominatim URL for a given city name string.
- Test `handleSearch` routes zero candidates to the "No locations found." status message.
- Test `handleSearch` routes a single candidate directly to `lookupAndRender`.
- Test `handleSearch` routes multiple candidates to `renderDisambiguation`.
- Test that the empty-input guard still fires before any `geocodeCity` call.

### Property-Based Tests

- Generate random non-empty city name strings and verify `geocodeCity` always produces a Nominatim URL containing the encoded city name, `countrycodes=us`, and `format=json`.
- Generate random arrays of 0, 1, or N (2–10) mock candidates and verify `handleSearch` always routes to the correct branch without throwing.
- Generate random non-geocoding inputs (empty strings, whitespace) and verify the guard behavior is preserved identically before and after the fix.

### Integration Tests

- Full search flow: type a city, submit, mock Nominatim returning one result, verify weather card renders.
- Disambiguation flow: mock Nominatim returning three results, verify disambiguation buttons appear, click one, verify weather card renders.
- Zero-results flow: mock Nominatim returning `[]`, verify "No locations found." is displayed and Search button is re-enabled.
- Error flow: mock `fetch` to throw during geocoding, verify "Location lookup failed: network error." is displayed.
