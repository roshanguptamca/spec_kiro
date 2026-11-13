# Design Document — Weather Forecast App

## Overview

The weather forecast app is a single-page web application consisting of two plain files — `index.html` and `weather.js` — served locally by a PowerShell HTTP server (`serve.ps1`). The user types any US city name, the app geocodes it via the Nominatim API to obtain latitude/longitude, then fetches current conditions and a 5-day forecast from the National Weather Service (NWS) public API. No API keys, no build tools, no npm packages, no classes or interfaces — just HTML and JavaScript ES modules.

The design keeps things intentionally flat: a handful of pure functions for data transformation, a small set of `async` functions for the three-step NWS fetch chain, and direct DOM manipulation for rendering. The only "infrastructure" is the PowerShell server that handles MIME types and auto-opens the browser.

### Key design decisions

- **Nominatim for geocoding** — The browser cannot call the NWS `/points` endpoint with a city name string directly; it needs coordinates. Nominatim is a free, CORS-friendly geocoding API that converts a city name to lat/lon without an API key.
- **NWS for weather data** — The National Weather Service API is public domain, requires no key, and provides authoritative US weather data.
- **No hardcoded city list** — City names typed by the user are passed directly to Nominatim. The app never stores or curates city names.
- **No caching** — Every search triggers fresh API calls; state is ephemeral.
- **ES modules** — `weather.js` is loaded as a plain `<script src="weather.js">` (no `type="module"` needed since there is a single file and no imports).

---

## Architecture

```
Browser
  └── index.html          Static markup + CSS + <script src="weather.js">
  └── weather.js          All app logic (pure functions + async fetch chain + DOM updates)

PowerShell
  └── serve.ps1           HttpListener on localhost:8080 — serves index.html + weather.js

External APIs
  └── Nominatim           https://nominatim.openstreetmap.org/search
                          Converts city name → { lat, lon }
  └── NWS /points         https://api.weather.gov/points/{lat},{lon}
                          Returns observationStations URL + forecast URL
  └── NWS /stations       https://api.weather.gov/stations/{id}/observations/latest
                          Current weather observation
  └── NWS /forecast       https://api.weather.gov/gridpoints/{office}/{x},{y}/forecast
                          Period-based 5-day forecast
```

### Request flow

```
User types city → handleSearch()
  │
  ├─► geocodeCity(cityName)
  │     GET Nominatim → [{lat, lon, display_name, ...}]
  │     Returns first result's lat/lon
  │
  ├─► fetchPoints(lat, lon)
  │     GET /points/{lat},{lon}
  │     Returns { observationStationsUrl, forecastUrl }
  │
  ├─► fetchCurrentConditions(observationStationsUrl)
  │     GET observationStationsUrl → stationIds[]
  │     Loop up to 3 stations:
  │       GET /stations/{id}/observations/latest
  │       Stop when temperature != null
  │     Returns obs properties object
  │
  └─► fetchForecast(forecastUrl)
        GET forecastUrl
        Returns periods[]
```

### Error boundaries

Each step in the chain can fail independently. Failures surface as thrown errors caught in `handleSearch`, which displays the message in the Status_Area and hides stale weather UI.

---

## Components and Interfaces

All logic lives in `weather.js` as plain functions — no classes, no interfaces.

### Geocoding

```
geocodeCity(cityName: string) → Promise<{ lat: string, lon: string, displayName: string }>
```
- Trims input, appends `countrycodes=us&format=json` to Nominatim query
- Throws descriptive error if zero results or network failure

### NWS fetch helpers

```
fetchNWS(url: string, stepLabel: string) → Promise<object>
```
- Sends GET with `User-Agent` and `Accept: application/geo+json` headers
- Throws if response is not 2xx, including the step label and status code

```
fetchPoints(lat: string, lon: string) → Promise<{ stationsUrl: string, forecastUrl: string }>
```

```
fetchCurrentConditions(stationsUrl: string) → Promise<obs: object>
```
- Tries up to 3 stations; throws specific "unavailable" message if all fail

```
fetchForecast(forecastUrl: string) → Promise<periods: array>
```

### Unit conversion helpers (pure functions)

```
cToF(celsius: number|null) → number|null
msToMph(metersPerSecond: number|null) → number|null
mToMiles(meters: number|null) → number|null
paToInHg(pascals: number|null) → number|null
degToCompass(degrees: number|null) → string
fmt(value: any, unit: string, fallback?: string) → string   // returns "N/A" when value is null
```

### Icon mapping

```
getWeatherIcon(description: string) → string (emoji)
```
Case-insensitive keyword matching in this priority order:
1. "thunderstorm" → ⛈️
2. "snow" → ❄️
3. "rain" or "drizzle" → 🌧️
4. "fog" or "mist" → 🌫️
5. "cloud" or "overcast" → ☁️
6. "clear" or "sunny" → ☀️
7. (default) → 🌡️

### Rendering functions

```
renderWeatherCard(cityName: string, obs: object) → void
renderForecastTable(periods: array) → void
setStatus(message: string, isError?: boolean) → void
showLoading() → void     // sets status text + disables Search_Button
hideResults() → void     // hides Weather_Card and Forecast_Table
```

### Main entry point

```
handleSearch() → void   (async)
```
Wires together: validate input → geocode → fetch NWS chain → render or show error.

---

## Data Models

### Nominatim response (relevant fields)

```js
// GET https://nominatim.openstreetmap.org/search?q=Seattle&countrycodes=us&format=json
[
  {
    "lat": "47.6038321",
    "lon": "-122.3300624",
    "display_name": "Seattle, King County, Washington, United States",
    // ...other fields ignored
  }
]
```

### NWS /points response (relevant fields)

```js
{
  "properties": {
    "observationStations": "https://api.weather.gov/gridpoints/SEW/124,67/stations",
    "forecast": "https://api.weather.gov/gridpoints/SEW/124,67/forecast",
    "relativeLocation": {
      "properties": { "city": "Seattle", "state": "WA" }
    }
  }
}
```

### NWS observation response (relevant fields)

```js
{
  "properties": {
    "textDescription": "Mostly Cloudy",
    "temperature":          { "value": 12.2,   "unitCode": "wmoUnit:degC" },
    "dewpoint":             { "value": 5.6,    "unitCode": "wmoUnit:degC" },
    "windDirection":        { "value": 220,    "unitCode": "wmoUnit:degree_(angle)" },
    "windSpeed":            { "value": 4.1,    "unitCode": "wmoUnit:m_s-1" },
    "windGust":             { "value": null,   "unitCode": "wmoUnit:m_s-1" },
    "barometricPressure":   { "value": 101800, "unitCode": "wmoUnit:Pa" },
    "visibility":           { "value": 16093,  "unitCode": "wmoUnit:m" },
    "relativeHumidity":     { "value": 72.5,   "unitCode": "wmoUnit:percent" },
    "windChill":            { "value": null,   "unitCode": "wmoUnit:degC" },
    "heatIndex":            { "value": null,   "unitCode": "wmoUnit:degC" }
  }
}
```

### NWS forecast period (relevant fields)

```js
{
  "name": "Tonight",
  "isDaytime": false,
  "temperature": 48,
  "temperatureUnit": "F",
  "shortForecast": "Mostly Cloudy",
  "detailedForecast": "...",
  "probabilityOfPrecipitation": { "value": 10 }
}
```

### Internal weather display object

The rendering functions receive the raw `obs.properties` object and extract values inline — no intermediate model object is created, keeping the code flat and simple.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Whitespace-only input is always rejected

*For any* string composed entirely of whitespace characters (spaces, tabs, newlines, or any combination thereof), the input validation logic SHALL reject the input, display "Please enter a city name." in the Status_Area, and SHALL NOT proceed to make a geocoding request.

**Validates: Requirements 1.2**

---

### Property 2: City name is always trimmed before geocoding

*For any* non-empty city name string with arbitrary leading and/or trailing whitespace, the query string sent to the Nominatim geocoder SHALL contain the trimmed value — the original surrounding whitespace SHALL NOT appear in the request URL.

**Validates: Requirements 1.3**

---

### Property 3: First geocoder result is always used for coordinates

*For any* non-empty array of Nominatim geocoder results (each containing a `lat` and `lon`), the app SHALL use the `lat` and `lon` from the element at index 0, regardless of how many results are returned.

**Validates: Requirements 1.4**

---

### Property 4: getWeatherIcon maps all descriptions to a valid emoji with correct priority

*For any* description string (including empty string and arbitrary Unicode), `getWeatherIcon` SHALL return one of the seven defined emoji values (`⛈️`, `❄️`, `🌧️`, `🌫️`, `☁️`, `☀️`, `🌡️`) and SHALL NOT throw. When a string contains multiple keyword matches (e.g., "thunderstorm with rain"), the emoji for the highest-priority keyword SHALL be returned. Matching SHALL be case-insensitive (e.g., "THUNDERSTORM" and "thunderstorm" both → `⛈️`).

**Validates: Requirements 3.2**

---

### Property 5: fmt returns "N/A" for any null or undefined value

*For any* unit string, calling `fmt(null, unit)` or `fmt(undefined, unit)` SHALL return the string `"N/A"`. When the value is a number, `fmt` SHALL return the value concatenated with the unit string.

**Validates: Requirements 3.4**

---

### Property 6: Station retry tries at most 3 stations and stops at first valid temperature

*For any* list of observation stations (of any length), the current-conditions fetch logic SHALL attempt at most 3 stations in order and SHALL stop as soon as it receives an observation with a non-null temperature value. If all candidates within the first 3 have null temperatures (or fail to respond), the function SHALL throw the "Live observation data is temporarily unavailable" error rather than trying additional stations.

**Validates: Requirements 2.2, 2.5**

---

### Property 7: Non-2xx HTTP responses always produce an error message containing the step label and status code

*For any* NWS API step label (e.g., "grid lookup", "stations lookup", "forecast lookup") and any HTTP status code outside the 2xx range (300–599), the error thrown by `fetchNWS` SHALL produce a Status_Area message that contains both the step label string and the numeric status code.

**Validates: Requirements 2.4, 4.1**

---

### Property 8: Any error always hides Weather_Card and Forecast_Table

*For any* error that occurs during a weather lookup (geocoding failure, NWS API failure, network error, or unexpected exception), the Weather_Card and Forecast_Table SHALL be hidden (not visible) after the error is handled, regardless of what data was previously displayed.

**Validates: Requirements 4.2**

---

### Property 9: Search_Button is always re-enabled after a lookup completes or fails

*For any* weather lookup outcome — successful data retrieval, geocoding failure, NWS API failure, or unexpected exception — the Search_Button SHALL be re-enabled (not disabled) after the lookup finishes, ensuring the user can always make another search attempt.

**Validates: Requirements 3.6**

---

### Property 10: Console error log always contains url, status, and message fields

*For any* error that occurs during an API retrieval step, the value passed to `console.error` SHALL be an object containing the keys `url` (a string or null), `status` (a number or null), and `message` (a string). No retrieval error SHALL be swallowed silently.

**Validates: Requirements 4.3**

---

## Error Handling

### Strategy

All errors propagate up to `handleSearch` via thrown exceptions. Each `async` helper throws an `Error` with a plain-language message that names the failed step and, when available, the HTTP status code.

### Error scenarios

| Scenario | Displayed message | Console log |
|---|---|---|
| Empty / whitespace input | "Please enter a city name." | — |
| Nominatim zero results | "City not found. Please try a valid US city name." | — |
| Nominatim network error | "Location lookup failed: network error." | `{ url, status: null, message }` |
| NWS /points non-2xx | "Weather data retrieval failed: NWS grid lookup returned HTTP {status}." | `{ url, status, message }` |
| NWS /stations non-2xx | "Weather data retrieval failed: stations lookup returned HTTP {status}." | `{ url, status, message }` |
| All 3 stations have null temp | "Live observation data is temporarily unavailable for this city. Please try again shortly." | `{ url, status: null, message }` |
| NWS /forecast non-2xx | "Weather data retrieval failed: forecast lookup returned HTTP {status}." | `{ url, status, message }` |
| Any unexpected JS error | Error message text | `{ url: null, status: null, message }` |

### On any error

1. `setStatus(message, isError=true)` renders the message in the Status_Area with error styling.
2. `hideResults()` sets `display: none` on `#weather-card` and `#forecast-table` so stale data is never visible alongside an error.
3. `console.error({ url, status, message })` logs structured diagnostics.
4. The Search_Button is re-enabled in the `finally` block.

---

## Testing Strategy

Given the project's constraints (no npm, no build tools, plain HTML/JS, 20-minute completion goal), the testing strategy is intentionally minimal.

### Syntax validation (primary automated check)

```powershell
node --check weather.js
```

If this exits with code 0, the JavaScript has no syntax errors. Per the product steering, this is the only required automated check.

### Manual smoke tests

After starting the server with `.\serve.ps1`:

| # | Action | Expected result |
|---|--------|-----------------|
| 1 | Load `http://localhost:8080` | City_Input and Search_Button render (Property 1 / Req 1.1) |
| 2 | Click Search with empty input | "Please enter a city name." in Status_Area (Property 1 / Req 1.2) |
| 3 | Type `"   "` (spaces only) + Search | Same validation message, no network request (Property 1 / Req 1.2) |
| 4 | Type `"Seattle"` + Search | Loading message appears, Weather_Card and Forecast_Table render (Req 3.1, 3.3) |
| 5 | Type `"   New York   "` (padded) + Search | Trimming works; NWS data loads successfully (Property 2 / Req 1.3) |
| 6 | Type `"xyznonexistentcity999"` + Search | "City not found. Please try a valid US city name." (Req 1.5) |
| 7 | Disconnect network, search any city | Error message names the failed step (Property 7 / Req 4.1) |
| 8 | After any error | Weather_Card and Forecast_Table are hidden; Search_Button re-enabled (Properties 8, 9) |
| 9 | Observe console on error | Log object has `url`, `status`, `message` keys (Property 10 / Req 4.3) |
| 10 | `node --check weather.js` | Exit code 0 (Req 5.5) |

### Notes on property-based testing

The pure functions — `getWeatherIcon`, `cToF`, `msToMph`, `mToMiles`, `paToInHg`, `degToCompass`, `fmt`, and the input validation/trimming logic — are well-suited for property-based testing with **fast-check** (JavaScript). Each Correctness Property above maps to exactly one `fc.property` test configured with a minimum of 100 iterations.

Since this project has no `package.json` and the product steering limits automated testing to `node --check`, formal PBT is not implemented now but is the natural next step if the project grows beyond its 20-minute scope. Each property is tagged with its requirement reference so future tests can be traced directly back to the spec:

- **Feature: weather-forecast-app, Property 1**: Whitespace-only input is always rejected
- **Feature: weather-forecast-app, Property 2**: City name is always trimmed before geocoding
- **Feature: weather-forecast-app, Property 3**: First geocoder result is always used
- **Feature: weather-forecast-app, Property 4**: getWeatherIcon maps all descriptions correctly
- **Feature: weather-forecast-app, Property 5**: fmt returns "N/A" for null/undefined
- **Feature: weather-forecast-app, Property 6**: Station retry tries at most 3, stops at first valid
- **Feature: weather-forecast-app, Property 7**: Non-2xx errors contain step label and status code
- **Feature: weather-forecast-app, Property 8**: Any error hides Weather_Card and Forecast_Table
- **Feature: weather-forecast-app, Property 9**: Search_Button is always re-enabled after lookup
- **Feature: weather-forecast-app, Property 10**: Console error log always has url, status, message
