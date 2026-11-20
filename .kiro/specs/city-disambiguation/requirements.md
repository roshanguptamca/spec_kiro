# Requirements Document

## Introduction

This feature extends the existing US Weather App to handle ambiguous city name input. When a user types a partial or ambiguous city name (e.g., "Chicag" or "Springfield"), the app queries Nominatim for all matching US cities. If multiple results are returned, the app presents them as a selectable list so the user can choose the intended city before the weather lookup proceeds. If exactly one result is returned, the app proceeds automatically without interrupting the user. This keeps the single-page, plain HTML + JavaScript architecture intact, requiring no build tools and no additional dependencies.

## Glossary

- **App**: The single-page weather forecast web application (`index.html` + `weather.js`).
- **User**: The human operating the App in a browser.
- **City_Input**: The text input field where the User types a city name or partial city name.
- **Search_Button**: The button the User activates to trigger a weather lookup.
- **Geocoder**: The Nominatim geocoding API (`https://nominatim.openstreetmap.org/search`) used to convert a city name string into one or more candidate results, each containing `lat`, `lon`, and `display_name`.
- **Candidate_List**: The ordered array of Nominatim results returned for a given query, each with `lat`, `lon`, and `display_name` fields.
- **Disambiguation_UI**: The UI element rendered inside `#weather-card` that displays the Candidate_List as a set of selectable options when the Candidate_List contains more than one entry.
- **Selection**: The single Candidate_List entry the User chooses from the Disambiguation_UI.
- **NWS_API**: The National Weather Service public REST API (`https://api.weather.gov`) used to retrieve current weather observations and forecasts.
- **Weather_Card**: The UI panel (`#weather-card`) that displays current weather conditions or, temporarily, the Disambiguation_UI.
- **Forecast_Table**: The UI table (`#forecast-table`) that displays the 5-day weather forecast.
- **Status_Area**: The UI region (`#status`) that displays loading, error, and informational messages.

---

## Requirements

### Requirement 1: Fetch All Matching Candidates from Nominatim

**User Story:** As a User, I want the App to retrieve all matching US city results for my input, so that I am not silently given the wrong city when multiple matches exist.

#### Acceptance Criteria

1. WHEN the User activates the Search_Button with a non-empty City_Input, THE App SHALL disable the Search_Button, query the Geocoder with the trimmed City_Input value, `countrycodes=us`, and `format=json`, and retain the full array of results (not just the first entry).
2. IF the Geocoder returns zero results, THEN THE App SHALL display a message in the Status_Area indicating that no matching US city was found, and SHALL NOT proceed to query the NWS_API.
3. IF the Geocoder request fails due to a network error or timeout, THEN THE App SHALL display a message in the Status_Area indicating that the location lookup failed, and SHALL NOT proceed to query the NWS_API.

---

### Requirement 2: Automatic Proceed for a Single Result

**User Story:** As a User, I want the App to proceed directly to the weather lookup when my input matches exactly one city, so that unambiguous searches are not interrupted.

#### Acceptance Criteria

1. WHEN the Geocoder returns a Candidate_List containing exactly one entry, THE App SHALL display the loading state ("Fetching weather data…" in the Status_Area, Search_Button disabled) and use that entry's `lat` and `lon` to proceed immediately to the NWS_API lookup without displaying the Disambiguation_UI.
2. WHEN weather data is successfully retrieved for a single Geocoder result, THE App SHALL display the `display_name` from that Candidate_List entry as the city name in the Weather_Card.

---

### Requirement 3: Display Disambiguation List for Multiple Results

**User Story:** As a User, I want to see a list of matching cities when my input is ambiguous, so that I can choose the specific city I intended before weather data is fetched.

#### Acceptance Criteria

1. WHEN the Geocoder returns a Candidate_List containing more than one entry, THE App SHALL render the Disambiguation_UI inside the Weather_Card and SHALL make the Weather_Card visible.
2. WHEN the Disambiguation_UI is rendered, THE App SHALL display up to 10 entries from the Candidate_List, each as a separately activatable item showing the entry's `display_name`.
3. WHEN the Disambiguation_UI is rendered, THE App SHALL display the message "Multiple locations found. Please select one:" in the Status_Area.
4. WHEN the Disambiguation_UI is rendered, THE App SHALL hide the Forecast_Table so no stale forecast data is visible alongside the disambiguation choices.
5. WHEN the Disambiguation_UI is rendered, THE App SHALL re-enable the Search_Button so the User can start a new search without selecting a city.

---

### Requirement 4: Proceed to Weather Lookup After User Selection

**User Story:** As a User, I want the App to fetch weather data for the city I selected from the disambiguation list, so that I receive accurate results for my chosen location.

#### Acceptance Criteria

1. WHEN the User selects an entry from the Disambiguation_UI, THE App SHALL use that entry's `lat` and `lon` to query the NWS_API.
2. WHEN the User selects an entry from the Disambiguation_UI, THE App SHALL hide the Disambiguation_UI and display the standard loading state ("Fetching weather data…" in the Status_Area, Search_Button disabled) before making NWS_API requests.
3. WHEN weather data is successfully retrieved after a selection, THE App SHALL display the selected entry's `display_name` as the city name in the Weather_Card.
4. IF the NWS_API lookup fails after a selection, THEN THE App SHALL display an error message in the Status_Area indicating that the weather lookup failed, re-enable the Search_Button, clear the loading indicator, and hide the Weather_Card and Forecast_Table.

---

### Requirement 5: Error Handling and UI State Consistency

**User Story:** As a User, I want the App to handle errors clearly at every stage of the disambiguation flow, so that I always know what happened and can try again.

#### Acceptance Criteria

1. WHEN a weather lookup completes or fails at any stage (geocoding, disambiguation selection, or NWS_API retrieval), THE App SHALL re-enable the Search_Button.
2. WHILE the Disambiguation_UI is visible, WHEN the User initiates a new search, THE App SHALL clear the Disambiguation_UI and hide the Weather_Card before making the new Geocoder request.
3. IF an error occurs after the User makes a selection from the Disambiguation_UI, THEN THE App SHALL log to the browser console an object containing: `url` (the failed URL as a string), `status` (the HTTP status code as a number, or `null` if no HTTP response was received), and `message` (the `.message` property of the caught exception).
