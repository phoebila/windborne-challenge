const map = L.map('map').setView([20, 0], 2);

// Base map
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

// Proxy to bypass CORS
const proxy = "https://corsproxy.io/?";

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

// Update markers for a specific hour
function updateMarkers(hour) {
  // Remove existing markers
  markers.forEach(m => map.removeLayer(m));
  markers = [];

  hourlyData[hour].forEach((b, idx) => {
    const marker = L.circleMarker([b[0], b[1]], {
      radius: 5,
      color: `hsl(${(idx * 47) % 360}, 100%, 50%)`,
      fillOpacity: 0.8
    })
    .bindPopup(`Balloon #${idx}<br/>Lat: ${b[0].toFixed(2)}<br/>Lon: ${b[1].toFixed(2)}`)
    .addTo(map);

    markers.push(marker);
  });
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

  slider.addEventListener("input", () => {
    const hour = Number(slider.value);
    label.textContent = `Hour: ${hour}`;
    updateMarkers(hour);
  });

  // Initialize at latest hour
  updateMarkers(hourlyData.length - 1);
}

init();
