# Implementation Plan: Weather Forecast App

## Overview

Implement a single-page US weather forecast app in plain HTML and JavaScript. The app geocodes user-entered city names via Nominatim, fetches current conditions and a 5-day forecast from the NWS public API, and renders results in a weather card and forecast table. The server is a PowerShell HTTP listener on localhost:8080.

## Tasks

- [x] 1. Rewrite `weather.js` — geocoding, NWS fetch chain, and unit helpers
  - [x] 1.1 Replace the hardcoded city list with a `geocodeCity(cityName)` function
    - Remove the `CITIES` array entirely
    - Implement `geocodeCity(cityName)` that trims input, calls `https://nominatim.openstreetmap.org/search` with `q=<trimmed>`, `countrycodes=us`, and `format=json`, and returns `{ lat, lon, displayName }` from index 0 of the response
    - Throw `"City not found. Please try a valid US city name."` when the array is empty
    - Throw `"Location lookup failed: network error."` on fetch failure
    - _Requirements: 1.3, 1.4, 1.5, 1.6_

  - [ ]* 1.2 Write property test for `geocodeCity` input trimming (Property 2)
    - **Property 2: City name is always trimmed before geocoding**
    - **Validates: Requirements 1.3**

  - [x] 1.3 Implement `fetchNWS(url, stepLabel)` with structured error throwing
    - Send `User-Agent` and `Accept: application/geo+json` headers on every NWS request
    - On non-2xx response, throw an `Error` whose message includes `stepLabel` and the HTTP status code
    - Log `{ url, status, message }` to `console.error` on every thrown error
    - _Requirements: 2.4, 2.6, 4.3_

  - [ ]* 1.4 Write property test for `fetchNWS` error format (Property 7)
    - **Property 7: Non-2xx HTTP responses always produce an error message containing the step label and status code**
    - **Validates: Requirements 2.4, 4.1**

  - [x] 1.5 Implement `fetchPoints(lat, lon)` returning `{ stationsUrl, forecastUrl }`
    - Calls `fetchNWS` with step label `"grid lookup"`
    - Extracts `properties.observationStations` and `properties.forecast`
    - _Requirements: 2.1_

  - [x] 1.6 Implement `fetchCurrentConditions(stationsUrl)` with 3-station retry
    - Fetch the stations list, then loop up to 3 stations
    - Stop at the first station that returns a non-null `temperature.value`
    - Throw `"Live observation data is temporarily unavailable for this city. Please try again shortly."` if all three fail
    - Log `{ url, status: null, message }` before throwing
    - _Requirements: 2.2, 2.5, 4.3_

  - [ ]* 1.7 Write property test for station retry logic (Property 6)
    - **Property 6: Station retry tries at most 3 stations and stops at first valid temperature**
    - **Validates: Requirements 2.2, 2.5**

  - [x] 1.8 Implement `fetchForecast(forecastUrl)` returning the periods array
    - Calls `fetchNWS` with step label `"forecast lookup"`
    - Returns `data.properties.periods`
    - _Requirements: 2.3_

  - [x] 1.9 Keep and verify all unit-conversion pure functions
    - Retain `cToF`, `msToMph`, `mToMiles`, `paToInHg`, `degToCompass`
    - Retain `fmt(value, unit, fallback)` — must return `"N/A"` when value is `null` or `undefined`
    - Retain `getWeatherIcon(description)` — keyword priority order must match Requirement 3.2 exactly
    - _Requirements: 3.1, 3.2, 3.4_

  - [ ]* 1.10 Write property test for `fmt` null/undefined handling (Property 5)
    - **Property 5: `fmt` returns "N/A" for any null or undefined value**
    - **Validates: Requirements 3.4**

  - [ ]* 1.11 Write property test for `getWeatherIcon` priority and coverage (Property 4)
    - **Property 4: `getWeatherIcon` maps all descriptions to a valid emoji with correct priority**
    - **Validates: Requirements 3.2**

- [x] 2. Implement rendering functions in `weather.js`
  - [x] 2.1 Implement `renderWeatherCard(cityName, obs)` writing all Weather_Card fields
    - Populate: city name, state/display name, emoji icon, temperature °F, description, feels-like °F, humidity %, wind mph + compass, visibility miles, dew point °F, barometric pressure inHg
    - Use `fmt(value, unit)` for all nullable fields so "N/A" appears when data is missing
    - Set `#weather-card` to `display: block`
    - _Requirements: 3.1, 3.4_

  - [x] 2.2 Implement `renderForecastTable(periods)` building the Forecast_Table
    - Show one row per period for the first 10 periods (5 days × day/night)
    - Columns: period name, emoji icon, short forecast, temperature °F, precipitation probability %
    - Set `#forecast-table` to `display: block`
    - _Requirements: 3.3_

  - [x] 2.3 Implement `setStatus(message, isError)`, `showLoading()`, and `hideResults()`
    - `showLoading()`: writes `"Fetching weather data…"` to Status_Area and disables Search_Button
    - `hideResults()`: sets `display: none` on `#weather-card` and `#forecast-table`
    - `setStatus(message, isError)`: sets text content and toggles error CSS class; clears text when message is empty
    - _Requirements: 3.5, 3.6, 4.2_

- [x] 3. Implement `handleSearch()` and wire all event listeners
  - [x] 3.1 Implement `handleSearch()` as the main async entry point
    - Validate: trim City_Input; if empty/whitespace, call `setStatus("Please enter a city name.", true)` and return
    - On valid input: call `showLoading()`, then `geocodeCity` → `fetchPoints` → `fetchCurrentConditions` + `fetchForecast` in parallel (`Promise.all`)
    - On success: call `setStatus("")`, `renderWeatherCard`, `renderForecastTable`
    - On any error: call `setStatus(err.message, true)` and `hideResults()`
    - In `finally`: re-enable Search_Button
    - _Requirements: 1.1, 1.2, 1.3, 3.5, 3.6, 4.1, 4.2_

  - [ ]* 3.2 Write property test for whitespace-only input validation (Property 1)
    - **Property 1: Whitespace-only input is always rejected**
    - **Validates: Requirements 1.2**

  - [ ]* 3.3 Write property test for Search_Button re-enable guarantee (Property 9)
    - **Property 9: Search_Button is always re-enabled after a lookup completes or fails**
    - **Validates: Requirements 3.6**

  - [ ]* 3.4 Write property test for error always hiding results (Property 8)
    - **Property 8: Any error always hides Weather_Card and Forecast_Table**
    - **Validates: Requirements 4.2**

  - [ ]* 3.5 Write property test for console error log structure (Property 10)
    - **Property 10: Console error log always contains url, status, and message fields**
    - **Validates: Requirements 4.3**

  - [x] 3.6 Wire event listeners at the bottom of `weather.js`
    - `Search_Button` click → `handleSearch()`
    - City_Input `keydown` Enter → `handleSearch()`
    - Remove all autocomplete and suggestion-related event listeners and DOM references (they are no longer needed without the CITIES array)
    - _Requirements: 1.1_

- [ ] 4. Update `index.html` to add the Forecast_Table and remove autocomplete markup
  - [~] 4.1 Add `#forecast-table` element below `#weather-card`
    - Add a `<table id="forecast-table">` with `<thead>` columns: Period, Conditions, Forecast, Temp, Precip %
    - Add `<tbody id="forecast-body">` for dynamic rows
    - Style consistently with the existing dark-glass card aesthetic
    - Set `display: none` initially
    - _Requirements: 3.3_

  - [~] 4.2 Remove the `#suggestions` dropdown and its associated CSS
    - Delete the `<div id="suggestions">` element and its CSS rules (no longer needed after removing the city list)
    - Ensure `City_Input` retains its `maxlength="100"` attribute
    - _Requirements: 1.1_

- [ ] 5. Validate `serve.ps1` and run syntax check
  - [~] 5.1 Verify `serve.ps1` handles port-conflict gracefully
    - Wrap `$listener.Start()` in a try/catch; on failure print a plain-text message indicating the port conflict and exit
    - _Requirements: 5.4_

  - [~] 5.2 Run `node --check weather.js` and confirm exit code 0
    - Execute `node --check weather.js` in the terminal
    - Fix any syntax errors reported before marking complete
    - _Requirements: 5.5_

- [~] 6. Final checkpoint — Ensure all tests pass
  - Run `node --check weather.js` one final time to confirm exit code 0
  - Ensure all tasks pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The product steering explicitly limits automated testing to `node --check`; property-based test sub-tasks are included for completeness but are not required for the 20-minute goal
- Each task references specific requirements for traceability
- `weather.js` and `index.html` are modified in-place; no new directories or build tools are introduced
- The CITIES array and autocomplete logic are removed entirely — city names flow directly from the UI through Nominatim

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.3", "1.9"] },
    { "id": 1, "tasks": ["1.2", "1.4", "1.5", "1.10", "1.11"] },
    { "id": 2, "tasks": ["1.6", "1.8"] },
    { "id": 3, "tasks": ["1.7", "2.1", "2.2", "2.3"] },
    { "id": 4, "tasks": ["3.1", "4.1", "4.2"] },
    { "id": 5, "tasks": ["3.2", "3.3", "3.4", "3.5", "3.6", "5.1"] },
    { "id": 6, "tasks": ["5.2"] }
  ]
}
```
