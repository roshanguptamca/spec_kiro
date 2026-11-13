/**
 * US Weather App
 * Data sources: National Weather Service API (api.weather.gov) — public domain, no key required.
 * City coordinates: curated list of major US cities for NWS grid lookup.
 */

// ---------------------------------------------------------------------------
// City database — name, state abbreviation, lat, lon
// Coordinates chosen to fall within NWS forecast grid coverage.
// ---------------------------------------------------------------------------
const CITIES = [
  { name: "Anchorage",       state: "AK", lat: 61.2181, lon: -149.9003 },
  { name: "Atlanta",         state: "GA", lat: 33.7490, lon: -84.3880  },
  { name: "Austin",          state: "TX", lat: 30.2672, lon: -97.7431  },
  { name: "Baltimore",       state: "MD", lat: 39.2904, lon: -76.6122  },
  { name: "Birmingham",      state: "AL", lat: 33.5186, lon: -86.8104  },
  { name: "Boise",           state: "ID", lat: 43.6150, lon: -116.2023 },
  { name: "Boston",          state: "MA", lat: 42.3601, lon: -71.0589  },
  { name: "Buffalo",         state: "NY", lat: 42.8864, lon: -78.8784  },
  { name: "Charleston",      state: "SC", lat: 32.7765, lon: -79.9311  },
  { name: "Charlotte",       state: "NC", lat: 35.2271, lon: -80.8431  },
  { name: "Chicago",         state: "IL", lat: 41.8781, lon: -87.6298  },
  { name: "Cincinnati",      state: "OH", lat: 39.1031, lon: -84.5120  },
  { name: "Cleveland",       state: "OH", lat: 41.4993, lon: -81.6944  },
  { name: "Colorado Springs",state: "CO", lat: 38.8339, lon: -104.8214 },
  { name: "Columbus",        state: "OH", lat: 39.9612, lon: -82.9988  },
  { name: "Dallas",          state: "TX", lat: 32.7767, lon: -96.7970  },
  { name: "Denver",          state: "CO", lat: 39.7392, lon: -104.9903 },
  { name: "Des Moines",      state: "IA", lat: 41.5868, lon: -93.6250  },
  { name: "Detroit",         state: "MI", lat: 42.3314, lon: -83.0458  },
  { name: "El Paso",         state: "TX", lat: 31.7619, lon: -106.4850 },
  { name: "Fargo",           state: "ND", lat: 46.8772, lon: -96.7898  },
  { name: "Fort Worth",      state: "TX", lat: 32.7555, lon: -97.3308  },
  { name: "Fresno",          state: "CA", lat: 36.7378, lon: -119.7871 },
  { name: "Honolulu",        state: "HI", lat: 21.3069, lon: -157.8583 },
  { name: "Houston",         state: "TX", lat: 29.7604, lon: -95.3698  },
  { name: "Indianapolis",    state: "IN", lat: 39.7684, lon: -86.1581  },
  { name: "Jacksonville",    state: "FL", lat: 30.3322, lon: -81.6557  },
  { name: "Kansas City",     state: "MO", lat: 39.0997, lon: -94.5786  },
  { name: "Las Vegas",       state: "NV", lat: 36.1699, lon: -115.1398 },
  { name: "Little Rock",     state: "AR", lat: 34.7465, lon: -92.2896  },
  { name: "Los Angeles",     state: "CA", lat: 34.0522, lon: -118.2437 },
  { name: "Louisville",      state: "KY", lat: 38.2527, lon: -85.7585  },
  { name: "Memphis",         state: "TN", lat: 35.1495, lon: -90.0490  },
  { name: "Miami",           state: "FL", lat: 25.7617, lon: -80.1918  },
  { name: "Milwaukee",       state: "WI", lat: 43.0389, lon: -87.9065  },
  { name: "Minneapolis",     state: "MN", lat: 44.9778, lon: -93.2650  },
  { name: "Nashville",       state: "TN", lat: 36.1627, lon: -86.7816  },
  { name: "New Orleans",     state: "LA", lat: 29.9511, lon: -90.0715  },
  { name: "New York City",   state: "NY", lat: 40.7128, lon: -74.0060  },
  { name: "Newark",          state: "NJ", lat: 40.7357, lon: -74.1724  },
  { name: "Norfolk",         state: "VA", lat: 36.8508, lon: -76.2859  },
  { name: "Oklahoma City",   state: "OK", lat: 35.4676, lon: -97.5164  },
  { name: "Omaha",           state: "NE", lat: 41.2565, lon: -95.9345  },
  { name: "Orlando",         state: "FL", lat: 28.5383, lon: -81.3792  },
  { name: "Philadelphia",    state: "PA", lat: 39.9526, lon: -75.1652  },
  { name: "Phoenix",         state: "AZ", lat: 33.4484, lon: -112.0740 },
  { name: "Pittsburgh",      state: "PA", lat: 40.4406, lon: -79.9959  },
  { name: "Portland",        state: "ME", lat: 43.6615, lon: -70.2553  },
  { name: "Portland",        state: "OR", lat: 45.5051, lon: -122.6750 },
  { name: "Raleigh",         state: "NC", lat: 35.7796, lon: -78.6382  },
  { name: "Richmond",        state: "VA", lat: 37.5407, lon: -77.4360  },
  { name: "Sacramento",      state: "CA", lat: 38.5816, lon: -121.4944 },
  { name: "Salt Lake City",  state: "UT", lat: 40.7608, lon: -111.8910 },
  { name: "San Antonio",     state: "TX", lat: 29.4241, lon: -98.4936  },
  { name: "San Diego",       state: "CA", lat: 32.7157, lon: -117.1611 },
  { name: "San Francisco",   state: "CA", lat: 37.7749, lon: -122.4194 },
  { name: "San Jose",        state: "CA", lat: 37.3382, lon: -121.8863 },
  { name: "Seattle",         state: "WA", lat: 47.6062, lon: -122.3321 },
  { name: "Sioux Falls",     state: "SD", lat: 43.5446, lon: -96.7311  },
  { name: "Spokane",         state: "WA", lat: 47.6588, lon: -117.4260 },
  { name: "St. Louis",       state: "MO", lat: 38.6270, lon: -90.1994  },
  { name: "Tampa",           state: "FL", lat: 27.9506, lon: -82.4572  },
  { name: "Tucson",          state: "AZ", lat: 32.2226, lon: -110.9747 },
  { name: "Tulsa",           state: "OK", lat: 36.1540, lon: -95.9928  },
  { name: "Virginia Beach",  state: "VA", lat: 36.8529, lon: -75.9780  },
  { name: "Washington",      state: "DC", lat: 38.9072, lon: -77.0369  },
  { name: "Wichita",         state: "KS", lat: 37.6872, lon: -97.3301  },
  { name: "Wilmington",      state: "NC", lat: 34.2257, lon: -77.9447  },
];

// ---------------------------------------------------------------------------
// Weather icon mapping — NWS shortForecast text → emoji
// ---------------------------------------------------------------------------
function getWeatherIcon(text) {
  if (!text) return "🌡️";
  const t = text.toLowerCase();
  if (t.includes("thunder"))           return "⛈️";
  if (t.includes("snow") || t.includes("blizzard")) return "❄️";
  if (t.includes("sleet") || t.includes("freezing rain")) return "🌨️";
  if (t.includes("rain") || t.includes("shower"))   return "🌧️";
  if (t.includes("drizzle"))           return "🌦️";
  if (t.includes("fog") || t.includes("mist"))       return "🌫️";
  if (t.includes("smoke") || t.includes("haze"))     return "😶‍🌫️";
  if (t.includes("dust") || t.includes("sand"))      return "💨";
  if (t.includes("tornado"))           return "🌪️";
  if (t.includes("partly cloudy") || t.includes("mostly sunny")) return "⛅";
  if (t.includes("mostly cloudy") || t.includes("partly sunny")) return "🌥️";
  if (t.includes("cloudy") || t.includes("overcast")) return "☁️";
  if (t.includes("sunny") || t.includes("clear"))   return "☀️";
  if (t.includes("wind"))              return "💨";
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

async function fetchNWS(url) {
  const res = await fetch(url, { headers: NWS_HEADERS });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`NWS API error ${res.status} for ${url}. ${body.slice(0, 120)}`);
  }
  return res.json();
}

async function getWeather(city) {
  // Step 1 — resolve grid point
  const pointUrl = `${NWS_BASE}/points/${city.lat},${city.lon}`;
  const pointData = await fetchNWS(pointUrl);
  const stationsUrl = pointData.properties?.observationStations;
  if (!stationsUrl) throw new Error("Could not find observation stations for this location.");

  // Step 2 — list nearby stations
  const stationsData = await fetchNWS(stationsUrl);
  const stations = stationsData.features;
  if (!stations || stations.length === 0) throw new Error("No observation stations found near this city.");

  // Step 3 — latest observation (try up to 3 stations in case one has no data)
  let obs = null;
  let usedStation = null;
  for (let i = 0; i < Math.min(3, stations.length); i++) {
    const stationId = stations[i].properties.stationIdentifier;
    const obsUrl = `${NWS_BASE}/stations/${stationId}/observations/latest`;
    try {
      const obsData = await fetchNWS(obsUrl);
      if (obsData.properties?.temperature?.value != null) {
        obs = obsData.properties;
        usedStation = stationId;
        break;
      }
    } catch (_) {
      // try next station
    }
  }

  if (!obs) throw new Error("Live observation data is temporarily unavailable for this city. Please try again shortly.");

  return { obs, usedStation };
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------
function setStatus(msg, isError = false) {
  const el = document.getElementById("status");
  el.textContent = msg;
  el.className = isError ? "error" : "";
}

function showSpinner(msg) {
  const el = document.getElementById("status");
  el.innerHTML = `<span class="spinner" aria-hidden="true"></span>${msg}`;
  el.className = "";
}

function renderWeather(city, obs, stationId) {
  const tempF   = cToF(obs.temperature?.value);
  const feelsF  = cToF(obs.heatIndex?.value ?? obs.windChill?.value ?? obs.temperature?.value);
  const humidity = obs.relativeHumidity?.value != null ? Math.round(obs.relativeHumidity.value) : null;
  const windSpeedMph = msToMph(obs.windSpeed?.value);
  const windDir = degToCompass(obs.windDirection?.value);
  const visibilityMiles = mToMiles(obs.visibility?.value);
  const dewpointF = cToF(obs.dewpoint?.value);
  const pressureInHg = paToInHg(obs.barometricPressure?.value);
  const description = obs.textDescription || "—";
  const icon = getWeatherIcon(description);

  document.getElementById("result-city").textContent  = city.name;
  document.getElementById("result-state").textContent = city.state;
  document.getElementById("result-temp").textContent  = tempF != null ? tempF : "—";
  document.getElementById("result-desc").textContent  = description;
  document.getElementById("result-icon").textContent  = icon;

  document.getElementById("result-feels").textContent      = fmt(feelsF, "°F");
  document.getElementById("result-humidity").textContent   = fmt(humidity, "%");
  document.getElementById("result-wind").textContent       = windSpeedMph != null
    ? `${windSpeedMph} mph ${windDir}`
    : "N/A";
  document.getElementById("result-visibility").textContent = fmt(visibilityMiles, " mi");
  document.getElementById("result-dewpoint").textContent   = fmt(dewpointF, "°F");
  document.getElementById("result-pressure").textContent   = fmt(pressureInHg, " inHg");
  document.getElementById("result-station").textContent    = stationId;

  document.getElementById("weather-card").style.display = "block";
}

// ---------------------------------------------------------------------------
// Autocomplete
// ---------------------------------------------------------------------------
let selectedIndex = -1;

function buildSuggestions(query) {
  const q = query.trim().toLowerCase();
  if (q.length < 1) return [];
  return CITIES.filter(c =>
    c.name.toLowerCase().startsWith(q) ||
    `${c.name.toLowerCase()}, ${c.state.toLowerCase()}`.startsWith(q)
  ).slice(0, 8);
}

function showSuggestions(matches) {
  const box = document.getElementById("suggestions");
  box.innerHTML = "";
  selectedIndex = -1;
  if (matches.length === 0) {
    box.style.display = "none";
    return;
  }
  matches.forEach((city, i) => {
    const div = document.createElement("div");
    div.textContent = `${city.name}, ${city.state}`;
    div.setAttribute("role", "option");
    div.setAttribute("data-index", i);
    div.addEventListener("mousedown", (e) => {
      e.preventDefault(); // don't blur input
      selectCity(city);
    });
    box.appendChild(div);
  });
  box.style.display = "block";
}

function hideSuggestions() {
  document.getElementById("suggestions").style.display = "none";
  selectedIndex = -1;
}

function selectCity(city) {
  document.getElementById("city-input").value = `${city.name}, ${city.state}`;
  hideSuggestions();
  search(city);
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------
let currentMatches = [];

async function search(cityObj) {
  const btn = document.getElementById("search-btn");
  btn.disabled = true;
  document.getElementById("weather-card").style.display = "none";
  showSpinner(`Fetching weather for ${cityObj.name}, ${cityObj.state}…`);

  try {
    const { obs, usedStation } = await getWeather(cityObj);
    setStatus("");
    renderWeather(cityObj, obs, usedStation);
  } catch (err) {
    setStatus(`Error: ${err.message}`, true);
    console.error(err);
  } finally {
    btn.disabled = false;
  }
}

function handleSearch() {
  hideSuggestions();
  const query = document.getElementById("city-input").value.trim();
  if (!query) {
    setStatus("Please enter a city name.", true);
    return;
  }

  // Try exact match first (city, ST format)
  const exact = CITIES.find(c =>
    `${c.name}, ${c.state}`.toLowerCase() === query.toLowerCase() ||
    c.name.toLowerCase() === query.toLowerCase()
  );

  if (exact) {
    search(exact);
    return;
  }

  // Partial match
  const matches = buildSuggestions(query);
  if (matches.length === 1) {
    search(matches[0]);
  } else if (matches.length > 1) {
    setStatus(`Multiple cities match "${query}". Please select one from the list.`, true);
    showSuggestions(matches);
  } else {
    setStatus(`"${query}" was not found. Try a major US city name.`, true);
  }
}

// ---------------------------------------------------------------------------
// Event listeners
// ---------------------------------------------------------------------------
document.getElementById("search-btn").addEventListener("click", handleSearch);

document.getElementById("city-input").addEventListener("input", (e) => {
  const matches = buildSuggestions(e.target.value);
  currentMatches = matches;
  showSuggestions(matches);
});

document.getElementById("city-input").addEventListener("keydown", (e) => {
  const box = document.getElementById("suggestions");
  const items = box.querySelectorAll("div");

  if (e.key === "ArrowDown") {
    e.preventDefault();
    selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
    items.forEach((el, i) => el.classList.toggle("active", i === selectedIndex));
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    selectedIndex = Math.max(selectedIndex - 1, -1);
    items.forEach((el, i) => el.classList.toggle("active", i === selectedIndex));
  } else if (e.key === "Enter") {
    if (selectedIndex >= 0 && currentMatches[selectedIndex]) {
      e.preventDefault();
      selectCity(currentMatches[selectedIndex]);
    } else {
      handleSearch();
    }
  } else if (e.key === "Escape") {
    hideSuggestions();
  }
});

document.getElementById("city-input").addEventListener("blur", () => {
  // Short delay so mousedown on suggestion fires first
  setTimeout(hideSuggestions, 150);
});
