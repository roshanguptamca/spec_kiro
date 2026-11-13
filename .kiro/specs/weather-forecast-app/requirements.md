# Requirements Document

## Introduction

A simple, single-page US weather forecast web application that lets users type any US city name, resolves the city to geographic coordinates via the Nominatim geocoding API (to avoid CORS issues), and then retrieves current weather conditions and a 5-day forecast from the National Weather Service (NWS) public API. Results include weather condition emoji icons and the forecast is displayed in a table. The app runs locally on `localhost:8080` via a PowerShell HTTP server script. No API keys, no caching, no classes or interfaces — just plain HTML and JavaScript (ES modules).

## Glossary

- **App**: The single-page weather forecast web application (`index.html` + `weather.js`).
- **User**: The human operating the App in a browser.
- **City_Input**: The text input field where the User types a city name.
- **Search_Button**: The button the User activates to trigger a weather lookup.
- **Geocoder**: The Nominatim geocoding API (`https://nominatim.openstreetmap.org/search`) used to convert a city name string into latitude/longitude coordinates.
- **NWS_API**: The National Weather Service public REST API (`https://api.weather.gov`) used to retrieve current weather observations and forecasts.
- **Weather_Card**: The UI panel that displays current weather conditions to the User.
- **Forecast_Table**: The UI table that displays the 5-day weather forecast to the User.
- **Status_Area**: The UI region that displays loading, error, and informational messages.
- **HTTP_Server**: The PowerShell script (`serve.ps1`) that serves static files on `localhost:8080`.

---

## Requirements

### Requirement 1: City Name Input and Geocoding

**User Story:** As a User, I want to type any US city name and have the App resolve it to coordinates, so that I can look up weather for any location without CORS errors or API keys.

#### Acceptance Criteria

1. WHEN the page loads, THE App SHALL render a City_Input text field (with a maximum length of 100 characters) and a Search_Button.
2. WHEN the User activates the Search_Button (by click or by pressing Enter) with a City_Input that is empty or contains only whitespace, THE App SHALL display the message "Please enter a city name." in the Status_Area.
3. WHEN the User activates the Search_Button with a non-empty City_Input, THE App SHALL trim leading and trailing whitespace from the City_Input value and send a request to the Geocoder with the city name as the query parameter, `countrycodes=us`, and `format=json`.
4. WHEN the Geocoder returns one or more results, THE App SHALL use the latitude and longitude from the first result to proceed with the NWS_API lookup.
5. IF the Geocoder returns zero results, THEN THE App SHALL display the message "City not found. Please try a valid US city name." in the Status_Area and SHALL NOT proceed to query the NWS_API.
6. IF the Geocoder request fails due to a network error, THEN THE App SHALL display an error message in the Status_Area indicating that the location lookup failed and SHALL NOT proceed to query the NWS_API.

---

### Requirement 2: Weather Data Retrieval from NWS

**User Story:** As a User, I want the App to fetch current conditions and a 5-day forecast from the National Weather Service, so that I receive authoritative, up-to-date US weather data at no cost.

#### Acceptance Criteria

1. WHEN coordinates are available, THE App SHALL query `https://api.weather.gov/points/{lat},{lon}` to retrieve the grid metadata for that location, including the observation stations URL and the forecast URL.
2. WHEN the points endpoint returns an observation stations URL, THE App SHALL query that URL and then query `https://api.weather.gov/stations/{stationId}/observations/latest` for the first station that returns a non-null temperature value, trying up to three stations before reporting failure.
3. WHEN the points endpoint returns a forecast URL of the form `https://api.weather.gov/gridpoints/{office}/{x},{y}/forecast`, THE App SHALL query that URL to retrieve the period-based forecast.
4. IF any NWS_API request returns an HTTP status code outside the 2xx range, THEN THE App SHALL display an error message in the Status_Area that identifies which step failed and includes the HTTP status code received.
5. IF no station within the first three candidates returns a non-null temperature, THEN THE App SHALL display "Live observation data is temporarily unavailable for this city. Please try again shortly." in the Status_Area.
6. THE App SHALL include a `User-Agent` header containing a contact identifier on every request sent to the NWS_API.

---

### Requirement 3: Weather Display with Icons and Forecast Table

**User Story:** As a User, I want to see current conditions with an icon and a 5-day forecast in a table, so that I can quickly understand today's weather and the week ahead.

#### Acceptance Criteria

1. WHEN current weather data is successfully retrieved, THE App SHALL display the following fields in the Weather_Card: city name, weather condition emoji icon, temperature in °F, weather description, feels-like temperature in °F, relative humidity as a percentage, wind speed in mph with compass direction, visibility in miles, dew point in °F, and barometric pressure in inHg.
2. WHEN weather data is successfully retrieved, THE App SHALL select the weather condition emoji icon by matching the description case-insensitively against the following keywords in order: "thunderstorm" → ⛈️, "snow" → ❄️, "rain" or "drizzle" → 🌧️, "fog" or "mist" → 🌫️, "cloud" or "overcast" → ☁️, "clear" or "sunny" → ☀️; any description not matching any keyword → 🌡️.
3. WHEN forecast data is successfully retrieved, THE App SHALL display a Forecast_Table with one row per forecast period for the next 5 days, with columns for: period name, emoji icon (using the same mapping as the Weather_Card), short forecast description, high/low temperature in °F, and precipitation probability as a percentage.
4. WHEN any weather observation field value is null or missing, THE App SHALL display "N/A" for that field.
5. WHEN a weather lookup is in progress, THE App SHALL display the message "Fetching weather data…" in the Status_Area and SHALL disable the Search_Button.
6. WHEN a weather lookup completes or fails, THE App SHALL re-enable the Search_Button.

---

### Requirement 4: Error Handling

**User Story:** As a User, I want clear error messages when something goes wrong, so that I understand what happened and can take corrective action.

#### Acceptance Criteria

1. WHEN any API request fails, THE App SHALL display an error message in the Status_Area written in plain language that names the action that failed (e.g., "location lookup" or "weather data retrieval") and the reason (e.g., "network error" or "service unavailable").
2. WHEN an error is displayed in the Status_Area, THE App SHALL hide the Weather_Card and Forecast_Table to prevent stale data from being shown alongside the error.
3. IF an error occurs during any retrieval step, THEN THE App SHALL log to the browser console an object containing the failed URL, the HTTP status code (if available), and the caught exception message.

---

### Requirement 5: Local Server and Code Validity

**User Story:** As a developer, I want to start the App with a single command and confirm the JavaScript has no syntax errors, so that I can run and validate the App quickly during development.

#### Acceptance Criteria

1. THE HTTP_Server SHALL serve all static files from the directory containing `serve.ps1` on `http://localhost:8080` and SHALL serve JavaScript files with the MIME type `application/javascript`.
2. WHEN a request is made to the root path `/`, THE HTTP_Server SHALL serve `index.html`.
3. WHEN the HTTP_Server starts successfully, THE HTTP_Server SHALL open `http://localhost:8080` in the default browser automatically.
4. IF port 8080 is already in use at startup, THEN THE HTTP_Server SHALL print a plain-text error message indicating the port conflict and exit without starting.
5. WHEN `node --check weather.js` is executed against a syntactically valid `weather.js`, THE Node_Runtime SHALL exit with code 0.
