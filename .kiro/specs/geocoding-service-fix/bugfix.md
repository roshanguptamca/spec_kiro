# Bugfix Requirements Document

## Introduction

The `geocodeCity` function in `weather.js` is broken in two ways: it targets a non-existent Census geocoder endpoint instead of Nominatim, and `handleSearch` destructures the result as `{ lat, lon, displayName }` instead of using the candidates array that the disambiguation flow expects. The combined effect is that every city search fails with an HTTP error or produces `undefined` coordinates, so no weather data is ever retrieved.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user searches for any city THEN the system constructs a URL pointing to `geocoding.geo.census.gov/geocoder/locations/invalid`, which is not a valid endpoint, causing an HTTP error and the message "Unable to reach the geocoding service".

1.2 WHEN `geocodeCity` returns a value THEN the system destructures it as `{ lat, lon, displayName }` in `handleSearch`, always yielding `undefined` for all three fields because the function returns a raw array, not an object with those keys.

1.3 WHEN `lat` and `lon` are `undefined` due to the incorrect destructuring THEN the system passes them to `fetchPoints`, which constructs a malformed NWS URL and receives an HTTP error, further preventing any weather data from loading.

### Expected Behavior (Correct)

2.1 WHEN a user searches for any city THEN the system SHALL send the geocoding request to `nominatim.openstreetmap.org` using the correct search endpoint (`/search?q=...&countrycodes=us&format=json`), and the response SHALL be a valid JSON array of location candidates each containing `lat`, `lon`, and `display_name` fields.

2.2 WHEN `geocodeCity` returns a candidate list containing more than one entry THEN `handleSearch` SHALL call `renderDisambiguation` with that array rather than destructuring any single candidate's fields.

2.3 WHEN `geocodeCity` returns exactly one candidate THEN the system SHALL call `lookupAndRender` directly with that candidate, skipping the disambiguation UI.

2.4 WHEN `geocodeCity` returns zero candidates THEN the system SHALL display a "No locations found" error message and re-enable the Search button.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN multiple candidates are returned THEN the system SHALL render the disambiguation button list via `renderDisambiguation` and await the user's selection before fetching weather data.

3.2 WHEN the user selects a candidate from the disambiguation list THEN the system SHALL call `lookupAndRender` with that candidate's `lat`, `lon`, and `display_name` fields to fetch and display weather data.

3.3 WHEN weather data is successfully retrieved THEN the system SHALL render the weather card and forecast table using the existing `renderWeatherCard` and `renderForecastTable` functions unchanged.

3.4 WHEN a network error occurs during the NWS API calls THEN the system SHALL display an error message describing the failure and hide the results card, and the Search button SHALL be re-enabled.

3.5 WHEN the city input field is empty and the user submits THEN the system SHALL show "Please enter a city name." without making any network requests.
