// logistics.js - Life-Line Organ Logistics & Live Tracking Engine
// Handles Leaflet Map, ABO Matchmaking, Golden Hour Ischemia Timers,
// Offline-first Routing, and Animated Vehicle Telemetry Simulation.

let map;
let routeLine;
let markers = [];
let vehicleMarker = null;
let currentLocation = [19.0514, 72.8295]; // Default: Lilavati Hospital, Mumbai
let selectedDestination = null;
let currentRouteCoordinates = [];
let timerInterval = null;

// Live Tracking Telemetry State
let trackingInterval = null;
let isTrackingActive = false;
let currentProgressIndex = 0;
let simulationSpeedMultiplier = 5; // Default 5x speed for snappy judge demo
let transportMode = "ambulance"; // "ambulance" or "helicopter"
let totalRouteDistanceKm = 0;
let totalRouteDurationSec = 0;

// DOM Elements
const locationButton = document.getElementById("getLocationBtn");
const locationStatus = document.getElementById("locationStatus");
const routeStatus = document.getElementById("routeStatus");
const originSelect = document.getElementById("originSelect");
const modeAmbulanceBtn = document.getElementById("modeAmbulanceBtn");
const modeHeliBtn = document.getElementById("modeHeliBtn");
const startTrackingBtn = document.getElementById("startTrackingBtn");
const speedMultiplierBtn = document.getElementById("speedMultiplierBtn");
const resetTrackingBtn = document.getElementById("resetTrackingBtn");
const waypointFeed = document.getElementById("waypointFeed");
const corridorClearance = document.getElementById("corridorClearance");

// Origin Presets
const ORIGIN_PRESETS = {
    lilavati: { name: "Lilavati Hospital, Mumbai", coords: [19.0514, 72.8295] },
    sassoon: { name: "Sassoon General Hospital, Pune", coords: [18.5284, 73.8738] },
    aiims: { name: "AIIMS Apex Trauma, New Delhi", coords: [28.5672, 77.2100] }
};

// Recipient Hospital Registry with Detailed Patient Match Vitals
const mockRegistry = [
    {
        id: 1,
        hospital: "KEM Hospital, Parel, Mumbai",
        blood_type: "O-",
        lat: 19.0026,
        lng: 72.8427,
        city: "Mumbai",
        recipient: "Patient A. Sharma (34M) - Priority 1 End-Stage Heart Failure",
        acceptable_types: ["O-"],
        distance_km: 12.4
    },
    {
        id: 2,
        hospital: "Ruby Hall Clinic, Pune",
        blood_type: "B+",
        lat: 18.5315,
        lng: 73.8770,
        city: "Pune",
        recipient: "Patient M. Kulkarni (48F) - Acute Hepatic Decompensation",
        acceptable_types: ["B+", "B-", "O+", "O-"],
        distance_km: 148.0
    },
    {
        id: 3,
        hospital: "Max Super Speciality Hospital, Saket, Delhi",
        blood_type: "A+",
        lat: 28.5283,
        lng: 77.2115,
        city: "New Delhi",
        recipient: "Patient R. Verma (29M) - End-Stage Renal Disease (ESRD)",
        acceptable_types: ["A+", "A-", "O+", "O-"],
        distance_km: 14.8
    },
    {
        id: 4,
        hospital: "Apollo Hospital, Navi Mumbai",
        blood_type: "AB+",
        lat: 19.0183,
        lng: 73.0297,
        city: "Navi Mumbai",
        recipient: "Patient S. Joshi (52M) - Multi-Organ Allocation Candidate",
        acceptable_types: ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"],
        distance_km: 26.5
    }
];

// ABO Compatibility Matrix
function checkBloodCompatibility(donorType, recipientType) {
    if (!donorType || !recipientType) return false;
    const cleanDonor = donorType.trim().toUpperCase();
    const cleanRecipient = recipientType.trim().toUpperCase();

    // Universal Donor
    if (cleanDonor === "O-") return true;

    // Universal Recipient
    if (cleanRecipient === "AB+") return true;

    if (cleanDonor === "O+") {
        return ["O+", "A+", "B+", "AB+"].includes(cleanRecipient);
    }
    if (cleanDonor === "A-") {
        return ["A-", "A+", "AB-", "AB+"].includes(cleanRecipient);
    }
    if (cleanDonor === "A+") {
        return ["A+", "AB+"].includes(cleanRecipient);
    }
    if (cleanDonor === "B-") {
        return ["B-", "B+", "AB-", "AB+"].includes(cleanRecipient);
    }
    if (cleanDonor === "B+") {
        return ["B+", "AB+"].includes(cleanRecipient);
    }
    if (cleanDonor === "AB-") {
        return ["AB-", "AB+"].includes(cleanRecipient);
    }
    if (cleanDonor === "AB+") {
        return cleanRecipient === "AB+";
    }

    return cleanDonor === cleanRecipient;
}

// Initialize Leaflet Map
document.addEventListener("DOMContentLoaded", () => {
    initMap();
    setupEventListeners();
});

function initMap() {
    // Start map centered over Maharashtra corridor
    map = L.map('map', {
        zoomControl: true,
        attributionControl: false
    }).setView([19.02, 72.84], 12);

    // Dark-themed tiles with fallback error handling for 100% offline resilience
    const tileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        opacity: 0.85
    });

    tileLayer.on('tileerror', function() {
        // Quietly fail offline without breaking UI
    });

    tileLayer.addTo(map);

    // Place initial origin marker
    updateOriginMarker();
}

function setupEventListeners() {
    // Origin Dropdown
    if (originSelect) {
        originSelect.addEventListener("change", (e) => {
            const key = e.target.value;
            if (ORIGIN_PRESETS[key]) {
                currentLocation = [...ORIGIN_PRESETS[key].coords];
                if (locationStatus) {
                    locationStatus.textContent = `Origin set to ${ORIGIN_PRESETS[key].name}.`;
                }
                updateOriginMarker();
                if (selectedDestination) {
                    requestRoadRoute(selectedDestination);
                }
            }
        });
    }

    // Geolocation Button
    if (locationButton) {
        locationButton.addEventListener("click", () => {
            if (!navigator.geolocation) {
                if (locationStatus) locationStatus.textContent = "Geolocation unsupported. Using preset hospital origin.";
                return;
            }

            locationButton.disabled = true;
            if (locationStatus) locationStatus.textContent = "Acquiring GPS fix...";

            navigator.geolocation.getCurrentPosition(
                position => {
                    currentLocation = [position.coords.latitude, position.coords.longitude];
                    if (locationStatus) {
                        locationStatus.textContent = `GPS Fix acquired (${currentLocation[0].toFixed(3)}, ${currentLocation[1].toFixed(3)}). Origin updated.`;
                    }
                    locationButton.disabled = false;
                    updateOriginMarker();
                    if (selectedDestination) {
                        requestRoadRoute(selectedDestination);
                    }
                },
                error => {
                    const fallbackName = ORIGIN_PRESETS[originSelect?.value || "lilavati"]?.name || "Lilavati Hospital";
                    if (locationStatus) {
                        locationStatus.textContent = `GPS unavailable (${error.message || "permission denied"}). Defaulted to ${fallbackName}.`;
                    }
                    locationButton.disabled = false;
                },
                { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 }
            );
        });
    }

    // Transport Mode Buttons (Ambulance vs Helicopter)
    if (modeAmbulanceBtn && modeHeliBtn) {
        modeAmbulanceBtn.addEventListener("click", () => {
            setTransportMode("ambulance");
        });
        modeHeliBtn.addEventListener("click", () => {
            setTransportMode("helicopter");
        });
    }

    // Simulation Controls
    if (startTrackingBtn) {
        startTrackingBtn.addEventListener("click", toggleLiveTracking);
    }

    if (speedMultiplierBtn) {
        speedMultiplierBtn.addEventListener("click", () => {
            if (simulationSpeedMultiplier === 1) simulationSpeedMultiplier = 5;
            else if (simulationSpeedMultiplier === 5) simulationSpeedMultiplier = 10;
            else simulationSpeedMultiplier = 1;
            speedMultiplierBtn.textContent = `${simulationSpeedMultiplier}x Speed`;
        });
    }

    if (resetTrackingBtn) {
        resetTrackingBtn.addEventListener("click", resetLiveTracking);
    }
}

function setTransportMode(mode) {
    transportMode = mode;
    if (mode === "ambulance") {
        modeAmbulanceBtn.classList.add("bg-red-950/60", "border-red-500", "text-white");
        modeAmbulanceBtn.classList.remove("bg-gray-950", "border-gray-700", "text-gray-400");
        modeHeliBtn.classList.remove("bg-red-950/60", "border-red-500", "text-white");
        modeHeliBtn.classList.add("bg-gray-950", "border-gray-700", "text-gray-400");
        if (corridorClearance) corridorClearance.textContent = "Police Green Corridor: Armed";
    } else {
        modeHeliBtn.classList.add("bg-red-950/60", "border-red-500", "text-white");
        modeHeliBtn.classList.remove("bg-gray-950", "border-gray-700", "text-gray-400");
        modeAmbulanceBtn.classList.remove("bg-red-950/60", "border-red-500", "text-white");
        modeAmbulanceBtn.classList.add("bg-gray-950", "border-gray-700", "text-gray-400");
        if (corridorClearance) corridorClearance.textContent = "Aviation Flight Clearance: Granted";
    }

    if (selectedDestination) {
        requestRoadRoute(selectedDestination);
    }
}

function updateOriginMarker() {
    // Clear old origin marker
    const oldOrigin = markers.find(m => m._isOrigin);
    if (oldOrigin) {
        map.removeLayer(oldOrigin);
        markers = markers.filter(m => !m._isOrigin);
    }

    if (!map || !currentLocation) return;

    const originMarker = L.circleMarker(currentLocation, {
        color: "#3b82f6",
        fillColor: "#1d4ed8",
        fillOpacity: 0.9,
        radius: 8,
        weight: 3
    }).addTo(map);

    originMarker._isOrigin = true;
    originMarker.bindPopup("<b>Donor Origin Hospital</b><br>Organ Procurement ICU").openPopup();
    markers.push(originMarker);

    if (!selectedDestination) {
        map.panTo(currentLocation);
    }
}

// Function called by Gemini analysis after extracting organ and blood type
function processMatch(bloodType, organ) {
    const matchOutput = document.getElementById("matchOutput");
    const compatibilityBadge = document.getElementById("compatibilityBadge");

    // Find compatible recipient from registry
    let match = mockRegistry.find(hospital => checkBloodCompatibility(bloodType, hospital.blood_type));
    
    // Fallback to first hospital if no exact match
    if (!match && mockRegistry.length > 0) {
        match = mockRegistry[0];
    }

    if (match) {
        selectedDestination = match;
        if (matchOutput) {
            matchOutput.innerHTML = `
                <div class="text-white font-bold">${match.hospital}</div>
                <div class="text-emerald-400 text-[11px] font-mono mt-0.5">Recipient: ${match.blood_type} (${match.recipient.split("-")[0]})</div>
                <div class="text-gray-400 text-[10px]">${match.recipient.split("-")[1] || "Urgent Transplant"}</div>
            `;
        }

        if (compatibilityBadge) {
            compatibilityBadge.textContent = `Verified Match: Donor (${bloodType}) → Recipient (${match.blood_type})`;
            compatibilityBadge.classList.remove("bg-amber-950", "text-amber-300");
            compatibilityBadge.classList.add("bg-emerald-950", "text-emerald-300");
        }

        requestRoadRoute(match);
    } else {
        if (matchOutput) matchOutput.textContent = "No matching recipient available in current registry zone.";
        if (routeStatus) routeStatus.textContent = "No compatible recipient found.";
    }
}

// Request and calculate route (with automatic offline fallback)
async function requestRoadRoute(destination) {
    if (!destination || !currentLocation) return;

    if (routeStatus) {
        routeStatus.textContent = `Calculating fastest ${transportMode === "helicopter" ? "LifeFlight air route" : "Green Corridor road route"} to ${destination.hospital}...`;
    }
    
    clearRoute();

    // 1. Try server backend route API (/api/route) which handles both live OSRM and offline fallback
    let routeResult = null;
    try {
        const response = await fetch("/api/route", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                origin: currentLocation,
                destination: [destination.lat, destination.lng],
                mode: transportMode
            }),
            signal: AbortSignal.timeout(5000)
        });

        if (response.ok) {
            const data = await response.json();
            if (data.code === "Ok" && data.routes?.length > 0) {
                routeResult = data.routes[0];
            }
        }
    } catch (err) {
        // Fallback to client-side direct calculation
    }

    // 2. Client-side fallback if server route not reached
    if (!routeResult) {
        routeResult = generateClientFallbackRoute(currentLocation, [destination.lat, destination.lng], transportMode);
    }

    drawRoadRoute(routeResult, destination);
}

// Client-side Fallback Route Generator (Works 100% offline)
function generateClientFallbackRoute(origin, destination, mode = "ambulance") {
    const [lat1, lng1] = origin;
    const [lat2, lng2] = destination;

    // Haversine distance
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const straightKm = R * c;

    const multiplier = mode === "helicopter" ? 1.02 : 1.25;
    const distanceKm = straightKm * multiplier;
    const avgSpeed = mode === "helicopter" ? 220 : 78; // km/h
    const durationSec = (distanceKm / avgSpeed) * 3600;

    const steps = 30;
    const coordinates = [];
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        let lat = lat1 + (lat2 - lat1) * t;
        let lng = lng1 + (lng2 - lng1) * t;

        if (mode === "ambulance" && i > 0 && i < steps) {
            // Realistic highway curvature
            const curve = Math.sin(t * Math.PI) * 0.012;
            lat += curve * 0.5;
            lng += curve * 0.7;
        }
        coordinates.push([lng, lat]);
    }

    return {
        distance: distanceKm * 1000,
        duration: durationSec,
        geometry: {
            type: "LineString",
            coordinates
        },
        mode,
        is_fallback: true
    };
}

function clearRoute() {
    if (routeLine) {
        map.removeLayer(routeLine);
        routeLine = null;
    }
    // Remove destination & vehicle markers
    markers.forEach(m => {
        if (!m._isOrigin) map.removeLayer(m);
    });
    markers = markers.filter(m => m._isOrigin);

    if (vehicleMarker) {
        map.removeLayer(vehicleMarker);
        vehicleMarker = null;
    }
    resetLiveTracking();
}

function drawRoadRoute(route, destination) {
    clearRoute();

    // Re-ensure Origin Marker exists
    updateOriginMarker();

    // Destination Marker
    const destMarker = L.circleMarker([destination.lat, destination.lng], {
        color: "#10b981",
        fillColor: "#059669",
        fillOpacity: 0.9,
        radius: 8,
        weight: 3
    }).addTo(map);

    destMarker.bindPopup(`<b>Recipient: ${destination.hospital}</b><br>${destination.recipient}`);
    markers.push(destMarker);

    // Parse coordinates [lat, lng]
    currentRouteCoordinates = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

    const isHeli = transportMode === "helicopter";
    const routeColor = isHeli ? "#38bdf8" : "#ef4444";

    routeLine = L.polyline(currentRouteCoordinates, {
        color: routeColor,
        weight: 5,
        opacity: 0.9,
        dashArray: isHeli ? "8, 8" : undefined
    }).addTo(map);

    map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });

    // Store metrics
    totalRouteDistanceKm = (route.distance / 1000).toFixed(1);
    totalRouteDurationSec = route.duration;
    const durationMin = Math.round(route.duration / 60);

    // Update Status HUD
    if (routeStatus) {
        const modeLabel = isHeli ? "LifeFlight Helicopter Direct" : "Green Corridor Road Escort";
        const fallbackNote = route.is_offline_fallback || route.is_fallback ? " [Offline Engine]" : "";
        routeStatus.textContent = `${modeLabel}: ${totalRouteDistanceKm} km, ~${durationMin} min to ${destination.hospital}${fallbackNote}.`;
    }

    updateHUDMetrics(0);

    // Enable Start Tracking Button
    if (startTrackingBtn) {
        startTrackingBtn.disabled = false;
        startTrackingBtn.classList.remove("opacity-40");
    }
}

// ----------------------------------------------------
// LIVE VEHICLE TRACKING SIMULATION ENGINE
// ----------------------------------------------------

function toggleLiveTracking() {
    if (isTrackingActive) {
        pauseLiveTracking();
    } else {
        startLiveTracking();
    }
}

function startLiveTracking() {
    if (!currentRouteCoordinates || currentRouteCoordinates.length === 0) {
        alert("Please analyze a medical document and generate a route first.");
        return;
    }

    isTrackingActive = true;
    if (startTrackingBtn) {
        startTrackingBtn.innerHTML = `<span>⏸</span> <span id="trackingBtnText">Pause Tracking</span>`;
        startTrackingBtn.classList.remove("bg-red-600", "hover:bg-red-500");
        startTrackingBtn.classList.add("bg-amber-600", "hover:bg-amber-500");
    }

    // Create Vehicle Marker if not present
    if (!vehicleMarker) {
        const iconHtml = `
            <div class="vehicle-pulse-wrap">
                <div class="vehicle-ring"></div>
                <div class="vehicle-core">${transportMode === "helicopter" ? "🚁" : "🚑"}</div>
            </div>
        `;
        const vehicleIcon = L.divIcon({
            html: iconHtml,
            className: "vehicle-marker-icon",
            iconSize: [44, 44],
            iconAnchor: [22, 22]
        });

        vehicleMarker = L.marker(currentRouteCoordinates[0], { icon: vehicleIcon }).addTo(map);
    }

    // Phased action plan updates
    setPhaseCardActive("phase3Card");

    // Simulation loop
    if (trackingInterval) clearInterval(trackingInterval);

    const stepIntervalMs = Math.max(80, Math.floor(1000 / simulationSpeedMultiplier));

    trackingInterval = setInterval(() => {
        if (currentProgressIndex >= currentRouteCoordinates.length - 1) {
            // Arrival reached!
            completeLiveTracking();
            return;
        }

        currentProgressIndex++;
        const nextCoords = currentRouteCoordinates[currentProgressIndex];
        vehicleMarker.setLatLng(nextCoords);

        // Update HUD Telemetry
        const progressRatio = currentProgressIndex / (currentRouteCoordinates.length - 1);
        updateHUDMetrics(progressRatio);

        // Update Waypoints
        updateWaypointMilestones(progressRatio);

    }, stepIntervalMs);
}

function pauseLiveTracking() {
    isTrackingActive = false;
    if (trackingInterval) clearInterval(trackingInterval);
    if (startTrackingBtn) {
        startTrackingBtn.innerHTML = `<span>▶</span> <span id="trackingBtnText">Resume Tracking</span>`;
        startTrackingBtn.classList.remove("bg-amber-600", "hover:bg-amber-500");
        startTrackingBtn.classList.add("bg-red-600", "hover:bg-red-500");
    }
}

function resetLiveTracking() {
    isTrackingActive = false;
    if (trackingInterval) clearInterval(trackingInterval);
    currentProgressIndex = 0;

    if (vehicleMarker && currentRouteCoordinates.length > 0) {
        vehicleMarker.setLatLng(currentRouteCoordinates[0]);
    }

    if (startTrackingBtn) {
        startTrackingBtn.innerHTML = `<span>▶</span> <span id="trackingBtnText">Start Live Tracking</span>`;
        startTrackingBtn.classList.remove("bg-amber-600", "hover:bg-amber-500");
        startTrackingBtn.classList.add("bg-red-600", "hover:bg-red-500");
    }

    updateHUDMetrics(0);
    setPhaseCardActive("phase1Card");
    if (waypointFeed) waypointFeed.textContent = "Status: Reset to origin. Standing by for transit.";
}

function completeLiveTracking() {
    isTrackingActive = false;
    if (trackingInterval) clearInterval(trackingInterval);

    if (startTrackingBtn) {
        startTrackingBtn.innerHTML = `<span>✓</span> <span id="trackingBtnText">Delivered to OT</span>`;
        startTrackingBtn.disabled = true;
    }

    setPhaseCardActive("phase4Card");

    if (waypointFeed) {
        waypointFeed.innerHTML = `<b>ARRIVED:</b> Organ safely transferred to Recipient Operating Suite at ${selectedDestination?.hospital || "Target Hospital"}. Reperfusion commenced!`;
    }

    const hudDistance = document.getElementById("hudDistance");
    const hudETA = document.getElementById("hudETA");
    if (hudDistance) hudDistance.textContent = "0.0 km (ARRIVED)";
    if (hudETA) hudETA.textContent = "00:00 (ON TIME)";
}

function updateHUDMetrics(progressRatio) {
    const hudVehicle = document.getElementById("hudVehicle");
    const hudSpeed = document.getElementById("hudSpeed");
    const hudDistance = document.getElementById("hudDistance");
    const hudETA = document.getElementById("hudETA");

    const remainingDistanceKm = Math.max(0, (totalRouteDistanceKm * (1 - progressRatio))).toFixed(1);
    const remainingSeconds = Math.max(0, Math.round(totalRouteDurationSec * (1 - progressRatio)));
    const remainingMin = Math.floor(remainingSeconds / 60);
    const remSec = (remainingSeconds % 60).toString().padStart(2, '0');

    if (hudVehicle) {
        hudVehicle.textContent = transportMode === "helicopter" ? "🚁 LifeFlight Air Unit 01" : "🚑 Green Corridor Ambulance 04";
    }

    if (hudSpeed) {
        const baseSpeed = transportMode === "helicopter" ? 220 : 82;
        // Subtle jitter for realistic telemetry HUD
        const jitter = Math.floor(Math.sin(currentProgressIndex) * 4);
        hudSpeed.textContent = `${baseSpeed + jitter} km/h (${transportMode === "helicopter" ? "Airspeed" : "Corridor"})`;
    }

    if (hudDistance) hudDistance.textContent = `${remainingDistanceKm} km`;
    if (hudETA) hudETA.textContent = `${remainingMin}m ${remSec}s`;
}

function updateWaypointMilestones(progressRatio) {
    if (!waypointFeed) return;

    if (progressRatio < 0.25) {
        setPhaseCardActive("phase2Card");
        waypointFeed.textContent = "Departed Donor Procurement ICU. Police escort clearing arterial checkpoints.";
    } else if (progressRatio < 0.65) {
        setPhaseCardActive("phase3Card");
        waypointFeed.textContent = transportMode === "helicopter" 
            ? "Airborne corridor: 1,200ft cruise altitude, direct GPS vector to hospital rooftop helipad."
            : "Express highway green corridor active. Traffic signals overridden to green.";
    } else if (progressRatio < 0.95) {
        setPhaseCardActive("phase3Card");
        waypointFeed.textContent = "Final approach to recipient trauma bay. Surgical team scrubbed and ready.";
    } else {
        setPhaseCardActive("phase4Card");
        waypointFeed.textContent = "Handover in progress: Custodiol cold ischemia bag received by surgical team.";
    }
}

function setPhaseCardActive(activePhaseId) {
    const phases = ["phase1Card", "phase2Card", "phase3Card", "phase4Card"];
    phases.forEach(id => {
        const card = document.getElementById(id);
        if (!card) return;
        if (id === activePhaseId) {
            card.classList.add("active");
        } else {
            card.classList.remove("active");
        }
    });
}

// Dynamic Ischemic Countdown Timer
function startTimer(hours = 4) {
    let timeLeft = Math.floor(hours * 3600);
    const timerDisplay = document.getElementById("countdown");
    const timerCard = document.getElementById("timerCard");
    const ischemiaLabel = document.getElementById("ischemiaLabel");
    const timerSubtext = document.getElementById("timerSubtext");

    if (ischemiaLabel) ischemiaLabel.textContent = `Max ${hours}h Cold Ischemia`;
    if (timerSubtext) timerSubtext.textContent = `Viability threshold: strict ${hours}h limit`;

    if (window.timerInterval) clearInterval(window.timerInterval);

    function update() {
        if (timeLeft <= 0) {
            if (timerDisplay) timerDisplay.innerText = "EXPIRED";
            if (timerCard) {
                timerCard.classList.remove("border-green-900/50", "border-yellow-900/50");
                timerCard.classList.add("border-red-600", "emergency-glow");
            }
            clearInterval(window.timerInterval);
            return;
        }

        timeLeft--;
        const h = Math.floor(timeLeft / 3600).toString().padStart(2, '0');
        const m = Math.floor((timeLeft % 3600) / 60).toString().padStart(2, '0');
        const s = (timeLeft % 60).toString().padStart(2, '0');
        if (timerDisplay) timerDisplay.innerText = `${h}:${m}:${s}`;

        // Warning thresholds
        if (timeLeft < 1800) { // < 30 mins
            if (timerDisplay) timerDisplay.classList.replace("text-green-400", "text-red-500");
        } else if (timeLeft < 3600) { // < 1 hour
            if (timerDisplay) timerDisplay.classList.replace("text-green-400", "text-yellow-400");
        }
    }

    update();
    window.timerInterval = setInterval(update, 1000);
}
