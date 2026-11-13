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

*For any* string composed entirely of whitespace characters (spaces, tabs, newlines), calling the input validation logic SHALL result in the "Please enter a city name." message being shown and no geocoding request being made.

**Validates: Requirements 1.2**

---

### Property 2: City name is always trimmed before geocoding

*For any* city name string with leading and/or trailing whitespace, the value sent to the Nominatim geocoder SHALL be the trimmed version of that string (i.e., `trim()` is applied before the query parameter is constructed).

**Validates: Requirements 1.3**

---

### Property 3: getWeatherIcon covers all inputs without throwing

*For any* string (including empty string, null-like, arbitrary Unicode), `getWeatherIcon` SHALL return one of the seven defined emoji values and SHALL NOT throw an exception.

**Validates: Requirements 3.2**

---

### Property 4: getWeatherIcon keyword priority is respected

*For any* description string that contains a higher-priority keyword (e.g., "thunderstorm") alongside a lower-priority keyword (e.g., "rain"), `getWeatherIcon` SHALL return the emoji for the higher-priority keyword.

**Validates: Requirements 3.2**

---

### Property 5: fmt returns "N/A" for null/undefined values

*For any* call to `fmt(value, unit)` where `value` is `null` or `undefined`, the function SHALL return `"N/A"` regardless of the unit string passed.

**Validates: Requirements 3.4**

---

### Property 6: Unit conversion round-trip stays within tolerance

*For any* temperature value in Celsius within the range −100°C to 60°C, converting to Fahrenheit with `cToF` and then back to Celsius using the inverse formula SHALL produce a value within ±1°C of the original.

**Validates: Requirements 3.1**

---

### Property 7: degToCompass returns a valid compass point for all 0–360 inputs

*For any* wind direction in degrees in the range [0, 360], `degToCompass` SHALL return one of the 16 compass point strings (N, NNE, NE, … NNW) and SHALL NOT return undefined or throw.

**Validates: Requirements 3.1**

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

### Syntax validation

```
node --check weather.js
```
If this exits with code 0, the JavaScript has no syntax errors. This is the primary automated check per the product steering.

### Manual smoke tests

After starting the server with `.\serve.ps1`:

1. Load `http://localhost:8080` — confirm the input and button render.
2. Click Search with empty input — confirm "Please enter a city name." appears.
3. Type "   " (spaces only) + Search — confirm same validation message.
4. Type "Seattle" + Search — confirm loading spinner appears, then Weather_Card and Forecast_Table render with data.
5. Type "   New York   " (padded) + Search — confirm trimming works; NWS data loads.
6. Type "xyznonexistentcity" + Search — confirm "City not found" message, no crash.
7. Verify that "N/A" appears for fields when NWS returns null values (can be observed with cities that have sparse observation data).

### Property-based testing

The pure functions (`getWeatherIcon`, `cToF`, `msToMph`, `mToMiles`, `paToInHg`, `degToCompass`, `fmt`, input trimming/validation) are good candidates for property-based testing with a library like **fast-check** (JavaScript). However, since this project has no package.json and no test infrastructure, and the product steering limits tests to `node --check`, formal PBT is noted here as an option for future hardening rather than a current implementation requirement.

If PBT were added, the properties identified in the Correctness Properties section above would each map to a single `fc.property` test run with a minimum of 100 iterations.
