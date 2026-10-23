// logistics.js - Handles Map, Mock Database, and UI Updates

let map;
let routeLine;
let markers = [];
let currentLocation = null;
let selectedDestination = null;
let timerInterval;

const locationButton = document.getElementById("getLocationBtn");
const locationStatus = document.getElementById("locationStatus");
const routeStatus = document.getElementById("routeStatus");

// Mock recipient destinations for the demo only.
const mockRegistry = [
    { id: 1, hospital: "KEM Hospital, Mumbai", blood_type: "O-", lat: 19.0264, lng: 72.8427, mode: "Helicopter" },
    { id: 2, hospital: "AIIMS, New Delhi", blood_type: "A+", lat: 28.5672, lng: 77.2100, mode: "Jet" },
    { id: 3, hospital: "Sassoon Hospital, Pune", blood_type: "B+", lat: 18.5284, lng: 73.8738, mode: "Ambulance" }
];

// Initialize the map on page load
document.addEventListener("DOMContentLoaded", () => {
    // Start map centered over Maharashtra
    map = L.map('map').setView([18.75, 73.5], 8);
    
    // Dark mode map tiles
    // L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    //     attribution: '&copy; OpenStreetMap &copy; CARTO'
    // }).addTo(map);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
}).addTo(map);
});

locationButton.addEventListener("click", () => {
    if (!navigator.geolocation) {
        locationStatus.textContent = "This browser does not support location access.";
        return;
    }

    locationButton.disabled = true;
    locationStatus.textContent = "Getting your current location...";
    navigator.geolocation.getCurrentPosition(
        position => {
            currentLocation = [position.coords.latitude, position.coords.longitude];
            locationStatus.textContent = "Current location set. Select Analyze & Route to find a route.";
            locationButton.disabled = false;
            if (selectedDestination) requestRoadRoute(selectedDestination);
        },
        error => {
            const messages = {
                1: "Location permission was denied. Allow location access in your browser to continue.",
                2: "Your current location could not be determined. Check your device's location settings.",
                3: "Location request timed out. Please try again."
            };
            locationStatus.textContent = messages[error.code] || "Could not get your current location. Please try again.";
            locationButton.disabled = false;
        },
        { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 }
    );
});

// Function called by Gemini after successful data extraction
function processMatch(bloodType, organ) {
    const match = mockRegistry.find(patient => patient.blood_type === bloodType);
    const matchOutput = document.getElementById("matchOutput");

    if (match) {
        matchOutput.textContent = `Demo match: ${match.hospital}. Road routing is for illustration only.`;
        selectedDestination = match;
        startTimer();
        if (currentLocation) {
            requestRoadRoute(match);
        } else {
            routeStatus.textContent = "Use my current location to calculate a road route to the demo hospital.";
        }
    } else {
        matchOutput.textContent = "No matching hospital in the demo registry.";
        selectedDestination = null;
        routeStatus.textContent = "No demo destination is available for this match.";
    }
}

async function requestRoadRoute(destination) {
    routeStatus.textContent = "Finding the shortest-distance road option returned by OSRM...";
    clearRoute();

    const [originLat, originLng] = currentLocation;
    const url = new URL(
        `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destination.lng},${destination.lat}`
    );
    url.search = new URLSearchParams({
        alternatives: "3",
        steps: "false",
        overview: "full",
        geometries: "geojson"
    }).toString();

    try {
        const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
        if (!response.ok) {
            throw new Error(`Routing service returned HTTP ${response.status}.`);
        }

        const result = await response.json();
        if (result.code !== "Ok" || !Array.isArray(result.routes) || result.routes.length === 0) {
            throw new Error("No road route was found between these locations.");
        }

        const shortestRoute = result.routes.reduce((shortest, route) =>
            route.distance < shortest.distance ? route : shortest
        );
        drawRoadRoute(shortestRoute, destination);

        const distanceKm = (shortestRoute.distance / 1000).toFixed(1);
        const durationMinutes = Math.round(shortestRoute.duration / 60);
        routeStatus.textContent = `Shortest-distance option returned by OSRM: ${distanceKm} km, about ${durationMinutes} min to ${destination.hospital}. Traffic is not included.`;
    } catch (error) {
        routeStatus.textContent = error.name === "TimeoutError"
            ? "The routing service timed out. Check your connection and try again."
            : error instanceof TypeError
                ? "Could not reach the routing service. Check your internet connection and try again."
                : error instanceof Error
                    ? error.message
                    : "Could not calculate a route. Please try again.";
    }
}

function clearRoute() {
    if (routeLine) map.removeLayer(routeLine);
    markers.forEach(m => map.removeLayer(m));
    markers = [];
}

function drawRoadRoute(route, destination) {
    clearRoute();
    const originMarker = L.circleMarker(currentLocation, { color: "red", radius: 8 })
        .addTo(map)
        .bindPopup("Your selected current location");
    const destinationMarker = L.circleMarker([destination.lat, destination.lng], { color: "green", radius: 8 })
        .addTo(map)
        .bindPopup(destination.hospital);
    markers.push(originMarker, destinationMarker);

    const routeCoordinates = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
    routeLine = L.polyline(routeCoordinates, {
        color: "#ef4444",
        weight: 4,
        opacity: 0.9
    }).addTo(map);
    map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
}

// 4-Hour Ischemic Countdown Timer
function startTimer() {
    let timeLeft = 4 * 60 * 60; // 4 hours in seconds
    const timerDisplay = document.getElementById("countdown");
    if (timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        if (timeLeft <= 0) return;
        timeLeft--;
        const h = Math.floor(timeLeft / 3600).toString().padStart(2, '0');
        const m = Math.floor((timeLeft % 3600) / 60).toString().padStart(2, '0');
        const s = (timeLeft % 60).toString().padStart(2, '0');
        timerDisplay.innerText = `${h}:${m}:${s}`;
    }, 1000);
}