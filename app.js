const map = L.map('map').setView([20, 0], 2);

// Base map
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

// Proxy to bypass CORS
const proxy = "https://corsproxy.io/?";

// OpenWeatherMap API key
const openWeatherApiKey = "YOUR_API_KEY"; // replace with your key

// Global variables
let hourlyData = [];
let balloonTracks = {};
let markers = [];

// Fetch balloon data
async function fetchBalloonData() {
  let data24h = [];

  for (let i = 0; i <= 23; i++) {
    const hour = i.toString().padStart(2, "0");
    const url = proxy + encodeURIComponent(`https://a.windbornesystems.com/treasure/${hour}.json`);

    try {
      const res = await fetch(url);
      const text = await res.text();

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        console.warn(`Skipping corrupted file: ${hour}.json`);
        continue;
      }

      if (Array.isArray(data)) data24h.push(data);
    } catch (e) {
      console.warn(`Skipping ${hour}.json`, e);
    }
  }

  return data24h;
}

// Fetch wind data for a specific lat/lon
async function fetchWind(lat, lon) {
  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${openWeatherApiKey}&units=metric`
    );
    const data = await res.json();
    return {
      speed: data.wind.speed, // m/s
      deg: data.wind.deg      // degrees
    };
  } catch (e) {
    console.warn("Wind fetch failed", e);
    return null;
  }
}

// Initialize tracks from hourly data
function buildBalloonTracks() {
  balloonTracks = {};
  hourlyData.forEach((snapshot, hourIdx) => {
    snapshot.forEach((b, idx) => {
      const lat = b[0];
      const lon = b[1];
      const alt = b[2];

      if (!balloonTracks[idx]) balloonTracks[idx] = [];
      balloonTracks[idx].push([lat, lon, alt]);
    });
  });
}

// Plot polylines (full 24h paths)
function plotPolylines() {
  Object.keys(balloonTracks).forEach((id, idx) => {
    const track = balloonTracks[id].map(p => [p[0], p[1]]);
    const color = `hsl(${(idx * 47) % 360}, 100%, 50%)`;
    L.polyline(track, { color, weight: 2 }).addTo(map);
  });
}

// Update markers for a specific hour (with wind data)
async function updateMarkers(hour) {
  // Remove existing markers
  markers.forEach(m => map.removeLayer(m));
  markers = [];

  for (let idx = 0; idx < hourlyData[hour].length; idx++) {
    const b = hourlyData[hour][idx];
    const lat = b[0], lon = b[1];

    const wind = await fetchWind(lat, lon);

    let popupText = `Balloon #${idx}<br/>Lat: ${lat.toFixed(2)}<br/>Lon: ${lon.toFixed(2)}`;
    if (wind) popupText += `<br/>Wind: ${wind.speed} m/s at ${wind.deg}°`;

    const marker = L.circleMarker([lat, lon], {
      radius: 5,
      color: `hsl(${(idx * 47) % 360}, 100%, 50%)`,
      fillOpacity: 0.8
    }).bindPopup(popupText).addTo(map);

    markers.push(marker);
  }
}

// Fit map to all balloons
function fitMapBounds() {
  const allPoints = Object.values(balloonTracks).flat().map(p => [p[0], p[1]]);
  if (allPoints.length > 0) map.fitBounds(allPoints);
}

// Main
async function init() {
  hourlyData = await fetchBalloonData();
  if (hourlyData.length === 0) return;

  buildBalloonTracks();
  plotPolylines();
  fitMapBounds();

  // Slider setup
  const sliderContainer = document.getElementById("sliderContainer");
  sliderContainer.innerHTML = `
    <input type="range" id="hourSlider" min="0" max="${hourlyData.length - 1}" value="${hourlyData.length - 1}">
    <span id="hourLabel">Hour: ${hourlyData.length - 1}</span>
  `;

  const slider = document.getElementById("hourSlider");
  const label = document.getElementById("hourLabel");

  slider.addEventListener("input", async () => {
    const hour = Number(slider.value);
    label.textContent = `Hour: ${hour}`;
    await updateMarkers(hour);
  });

  // Initialize at latest hour
  await updateMarkers(hourlyData.length - 1);
}

init();
