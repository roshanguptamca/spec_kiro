/**
 * US Weather App
 * Data sources: National Weather Service API (api.weather.gov) — public domain, no key required.
 * City geocoding: Nominatim (nominatim.openstreetmap.org) — free, no API key required.
 */

// ---------------------------------------------------------------------------
// Geocoding — convert a city name string to { lat, lon, displayName }
// ---------------------------------------------------------------------------
async function geocodeCity(cityName) {
  const trimmed = cityName.trim();
  const url = `https://geocoding.geo.census.gov/geocoder/locations?q=${encodeURIComponent(trimmed)}&countrycodes=us&format=json`;

  let results;
  try {
    const res = await fetch(url);
    results = await res.json();
  } catch (_) {
    throw new Error("Location lookup failed: network error.");
  }

  return results || [];
}

// ---------------------------------------------------------------------------
// Weather icon mapping — keyword priority order per Requirement 3.2
// ---------------------------------------------------------------------------
function getWeatherIcon(description) {
  if (!description) return "🌡️";
  const d = description.toLowerCase();
  if (d.includes("thunderstorm"))                    return "⛈️";
  if (d.includes("snow"))                            return "❄️";
  if (d.includes("rain") || d.includes("drizzle"))   return "🌧️";
  if (d.includes("fog")  || d.includes("mist"))      return "🌫️";
  if (d.includes("cloud") || d.includes("overcast")) return "☁️";
  if (d.includes("clear") || d.includes("sunny"))    return "☀️";
  return "🌡️";
}

// ---------------------------------------------------------------------------
// Unit helpers
// ---------------------------------------------------------------------------
function cToF(c) {
  if (c == null) return null;
  return Math.round(c * 9 / 5 + 32);
}

function msToMph(ms) {
  if (ms == null) return null;
  return Math.round(ms * 2.23694);
}

function mToMiles(m) {
  if (m == null) return null;
  return (m / 1609.344).toFixed(1);
}

function paToInHg(pa) {
  if (pa == null) return null;
  return (pa / 3386.389).toFixed(2);
}

function degToCompass(deg) {
  if (deg == null) return "—";
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

function fmt(val, unit, fallback = "N/A") {
  return val != null ? `${val}${unit}` : fallback;
}

// ---------------------------------------------------------------------------
// NWS API calls — three-step chain
// Step 1: /points/{lat},{lon}         → get observationStations URL
// Step 2: observationStations URL     → get first station ID
// Step 3: /stations/{id}/observations/latest → current conditions
// ---------------------------------------------------------------------------
const NWS_BASE = "https://api.weather.gov";
const NWS_HEADERS = {
  "User-Agent": "USWeatherApp/1.0 (educational project; contact@example.com)",
  "Accept": "application/geo+json",
};

async function fetchNWS(url, stepLabel) {
  const res = await fetch(url, { headers: NWS_HEADERS });
  if (!res.ok) {
    const message = `Weather data retrieval failed: ${stepLabel} returned HTTP ${res.status}.`;
    console.error({ url, status: res.status, message });
    throw new Error(message);
  }
  return res.json();
}

async function fetchPoints(lat, lon) {
  const url = `${NWS_BASE}/points/${lat},${lon}`;
  const data = await fetchNWS(url, "grid lookup");
  const stationsUrl = data.properties.observationStations;
  const forecastUrl = data.properties.forecast;
  return { stationsUrl, forecastUrl };
}

async function fetchForecast(forecastUrl) {
  const data = await fetchNWS(forecastUrl, "forecast lookup");
  return data.properties.periods;
}

async function fetchCurrentConditions(stationsUrl) {
  const stationsData = await fetchNWS(stationsUrl, "stations lookup");
  const features = stationsData.features;

  for (let i = 0; i < Math.min(3, features.length); i++) {
    const stationId = features[i].properties.stationIdentifier;
    const obsUrl = `${NWS_BASE}/stations/${stationId}/observations/latest`;
    const obs = await fetchNWS(obsUrl, "observation lookup");
    if (obs.properties.temperature.value !== null) {
      return obs.properties;
    }
  }

  const message = "Live observation data is temporarily unavailable for this city. Please try again shortly.";
  console.error({ url: stationsUrl, status: null, message });
  throw new Error(message);
}

// ---------------------------------------------------------------------------
// Unit toggle state — holds raw Celsius values for the current observation
// ---------------------------------------------------------------------------
let currentUnit = "F"; // "F" or "C"
let currentObs  = null; // raw NWS observation properties
let currentForecastPeriods = null; // raw NWS forecast periods

function fToC(f) {
  if (f == null) return null;
  return Math.round((f - 32) * 5 / 9);
}

function applyUnitToggle() {
  if (!currentObs) return;

  const isCelsius = currentUnit === "C";

  // Main temperature
  const tempC = currentObs.temperature.value;
  const tempF = cToF(tempC);
  const temp  = isCelsius ? Math.round(tempC) : tempF;
  document.getElementById("result-temp").textContent = temp != null ? temp : "—";
  document.getElementById("result-temp-unit").textContent = isCelsius ? "°C" : "°F";
  document.getElementById("unit-toggle").textContent      = isCelsius ? "°F" : "°C";
  document.getElementById("unit-toggle").setAttribute("aria-label",
    isCelsius ? "Switch to Fahrenheit" : "Switch to Celsius");

  // Feels like
  const feelsRaw = currentObs.heatIndex.value != null
    ? currentObs.heatIndex.value
    : currentObs.windChill.value != null
      ? currentObs.windChill.value
      : null;
  const feelsF = cToF(feelsRaw);
  const feelsC = feelsRaw != null ? Math.round(feelsRaw) : null;
  const feels  = isCelsius ? feelsC : feelsF;
  document.getElementById("result-feels").textContent = fmt(feels, isCelsius ? "°C" : "°F");

  // Dew point
  const dewC = currentObs.dewpoint.value;
  const dewF = cToF(dewC);
  const dew  = isCelsius ? (dewC != null ? Math.round(dewC) : null) : dewF;
  document.getElementById("result-dewpoint").textContent = fmt(dew, isCelsius ? "°C" : "°F");

  // Forecast table
  if (currentForecastPeriods) {
    const rows = document.querySelectorAll("#forecast-body tr");
    const periods = currentForecastPeriods.slice(0, 10);
    rows.forEach(function(tr, i) {
      const period = periods[i];
      if (!period) return;
      const tdTemp = tr.querySelectorAll("td")[3];
      if (isCelsius) {
        const fVal = period.temperature; // NWS always returns °F
        const cVal = fToC(fVal);
        tdTemp.textContent = cVal + "\u00B0C";
      } else {
        tdTemp.textContent = period.temperature + "\u00B0" + period.temperatureUnit;
      }
    });
  }
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------
function setStatus(msg, isError = false) {
  const el = document.getElementById("status");
  el.textContent = msg;
  el.className = isError ? "error" : "";
}

function showLoading() {
  setStatus("Fetching weather data…");
  document.getElementById("search-btn").disabled = true;
}

function hideResults() {
  const card = document.getElementById("weather-card");
  const table = document.getElementById("forecast-table");
  if (card)  card.style.display  = "none";
  if (table) table.style.display = "none";
}

// ---------------------------------------------------------------------------
// renderWeatherCard(cityName, obs) — Requirements 3.1, 3.4
// cityName: string from geocodeCity displayName (or user input)
// obs: raw properties object from NWS observation response
// ---------------------------------------------------------------------------
function renderWeatherCard(cityName, obs) {
  currentObs  = obs;
  currentUnit = "F"; // reset to Fahrenheit on each new search

  const description  = obs.textDescription || "—";
  const icon         = getWeatherIcon(description);
  const tempF        = cToF(obs.temperature.value);

  // Feels-like: prefer heatIndex, fall back to windChill, else null
  const feelsRaw     = obs.heatIndex.value != null
    ? obs.heatIndex.value
    : obs.windChill.value != null
      ? obs.windChill.value
      : null;
  const feelsF       = cToF(feelsRaw);

  const humidity     = obs.relativeHumidity.value != null
    ? Math.round(obs.relativeHumidity.value)
    : null;
  const windSpeedMph = msToMph(obs.windSpeed.value);
  const windDir      = degToCompass(obs.windDirection.value);
  const visibilityMi = mToMiles(obs.visibility.value);
  const dewpointF    = cToF(obs.dewpoint.value);
  const pressureInHg = paToInHg(obs.barometricPressure.value);

  document.getElementById("result-city").textContent  = cityName;
  document.getElementById("result-state").textContent = "";
  document.getElementById("result-icon").textContent  = icon;
  document.getElementById("result-temp").textContent  = tempF != null ? tempF : "—";
  document.getElementById("result-temp-unit").textContent = "°F";
  document.getElementById("unit-toggle").textContent  = "°C";
  document.getElementById("unit-toggle").setAttribute("aria-label", "Switch to Celsius");
  document.getElementById("result-desc").textContent  = description;

  document.getElementById("result-feels").textContent      = fmt(feelsF, "°F");
  document.getElementById("result-humidity").textContent   = fmt(humidity, "%");
  document.getElementById("result-wind").textContent       = windSpeedMph != null
    ? `${windSpeedMph} mph ${windDir}`
    : "N/A";
  document.getElementById("result-visibility").textContent = fmt(visibilityMi, " mi");
  document.getElementById("result-dewpoint").textContent   = fmt(dewpointF, "°F");
  document.getElementById("result-pressure").textContent   = fmt(pressureInHg, " inHg");

  document.getElementById("weather-card").style.display = "block";
}

// ---------------------------------------------------------------------------
// Forecast table rendering — Requirement 3.3
// ---------------------------------------------------------------------------
function renderForecastTable(periods) {
  currentForecastPeriods = periods;
  const tbody = document.getElementById("forecast-body");
  tbody.innerHTML = "";

  const rows = periods.slice(0, 10);
  rows.forEach(function(period) {
    const tr = document.createElement("tr");

    // Period name
    const tdName = document.createElement("td");
    tdName.textContent = period.name;
    tr.appendChild(tdName);

    // Emoji icon
    const tdIcon = document.createElement("td");
    tdIcon.textContent = getWeatherIcon(period.shortForecast);
    tdIcon.setAttribute("aria-hidden", "true");
    tr.appendChild(tdIcon);

    // Short forecast description
    const tdForecast = document.createElement("td");
    tdForecast.textContent = period.shortForecast;
    tr.appendChild(tdForecast);

    // Temperature in °F
    const tdTemp = document.createElement("td");
    tdTemp.textContent = period.temperature + "\u00B0" + period.temperatureUnit;
    tr.appendChild(tdTemp);

    // Precipitation probability
    const tdPrecip = document.createElement("td");
    const precipVal = period.probabilityOfPrecipitation
      ? period.probabilityOfPrecipitation.value
      : null;
    tdPrecip.textContent = (precipVal != null ? precipVal : "N/A") + (precipVal != null ? "%" : "");
    tr.appendChild(tdPrecip);

    tbody.appendChild(tr);
  });

  document.getElementById("forecast-table").style.display = "block";
}

// ---------------------------------------------------------------------------
// lookupAndRender(candidate) — shared NWS lookup path (Requirements 2.1, 2.2, 4.1, 4.2, 4.3, 4.4, 5.1)
// candidate: { lat, lon, display_name }
// ---------------------------------------------------------------------------
async function lookupAndRender(candidate) {
  showLoading();
  hideResults();

  try {
    const { stationsUrl, forecastUrl } = await fetchPoints(candidate.lat, candidate.lon);
    const [obs, periods] = await Promise.all([
      fetchCurrentConditions(stationsUrl),
      fetchForecast(forecastUrl)
    ]);
    setStatus("");
    renderWeatherCard(candidate.display_name, obs);
    renderForecastTable(periods);
  } catch (err) {
    setStatus(err.message, true);
    hideResults();
    console.error({ url: null, status: null, message: err.message });
  } finally {
    document.getElementById("search-btn").disabled = false;
  }
}

// ---------------------------------------------------------------------------
// renderDisambiguation(candidates) — Requirements 3.1, 3.2, 3.3, 3.4, 3.5
// ---------------------------------------------------------------------------
function renderDisambiguation(candidates) {
  const limited = candidates.slice(0, 10);

  let html = "";
  limited.forEach(function(candidate) {
    const escaped = candidate.display_name
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    html += '<button class="disambig-btn" data-name="' + escaped + '">' + escaped + '</button>';
  });

  const card = document.getElementById("weather-card");
  card.innerHTML = html;
  card.style.display = "block";

  // Attach click handlers after inserting into DOM
  const buttons = card.querySelectorAll(".disambig-btn");
  buttons.forEach(function(btn, i) {
    btn.addEventListener("click", function() {
      lookupAndRender(limited[i]);
    });
  });

  document.getElementById("forecast-table").style.display = "none";
  document.getElementById("search-btn").disabled = false;
  setStatus("Multiple locations found. Please select one:");
}

// ---------------------------------------------------------------------------
// handleSearch — main async entry point (Requirements 1.1, 1.2, 1.3, 3.5, 3.6, 4.1, 4.2)
// ---------------------------------------------------------------------------
async function handleSearch() {
  const cityName = document.getElementById("city-input").value.trim();

  if (!cityName) {
    setStatus("Please enter a city name.", true);
    return;
  }

  showLoading();
  hideResults();

  try {
    const { lat, lon, displayName } = await geocodeCity(cityName);
    const { stationsUrl, forecastUrl } = await fetchPoints(lat, lon);
    const [obs, periods] = await Promise.all([
      fetchCurrentConditions(stationsUrl),
      fetchForecast(forecastUrl)
    ]);
    setStatus("");
    renderWeatherCard(displayName, obs);
    renderForecastTable(periods);
  } catch (err) {
    setStatus(err.message, true);
    hideResults();
    console.error({ url: null, status: null, message: err.message });
  } finally {
    document.getElementById("search-btn").disabled = false;
  }
}

// ---------------------------------------------------------------------------
// Event listeners (Requirements 1.1)
// ---------------------------------------------------------------------------
document.getElementById("search-btn").addEventListener("click", handleSearch);

document.getElementById("city-input").addEventListener("keydown", function(e) {
  if (e.key === "Enter") handleSearch();
});

document.getElementById("unit-toggle").addEventListener("click", function() {
  currentUnit = currentUnit === "F" ? "C" : "F";
  applyUnitToggle();
});
