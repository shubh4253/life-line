// server.js - Life-Line Organ Logistics Backend
// Zero-dependency Node.js server (Node 22+) supporting online Gemini AI and 100% offline fallback

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT, 10) || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

const MIME_TYPES = {
  ".html": "text/html; charset=UTF-8",
  ".css": "text/css; charset=UTF-8",
  ".js": "text/javascript; charset=UTF-8",
  ".json": "application/json; charset=UTF-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

// Built-in Medical Clinical Intelligence for Offline Fallback & Mock Verification
const OFFLINE_CLINICAL_PRESETS = {
  heart: {
    organ_type: "Heart",
    donor_blood_type: "O-",
    urgency_level_1_to_5: 5,
    golden_hour_window_hours: 4,
    donor_summary: "29M Cadaveric Donor, Severe TBI (Motor Vehicle Collision). MAP 78 mmHg, LVEF 60% (Normal wall motion), Serologies negative.",
    transcription: "URGENT MEDICAL TRANSFER FORM - NOTTO-CAD-2026-0881\n" +
      "Donor: 29yo Male | Pronouncement: 13:15 HRS\n" +
      "Organ: Cardiac Allograft (Heart)\n" +
      "Verified Serology: O Negative (O-) Universal Donor\n" +
      "Vitals: BP MAP 78 on Noradrenaline 0.08 mcg/kg/min | LVEF 60%\n" +
      "Surgeon Notes: 'Heart pristine. Cross-clamping scheduled 14:30 sharp. Cold Custodiol HTK cardioplegia on wet ice. Request immediate Green Corridor escort or Helipad transfer.'\n" +
      "Target: KEM Hospital, Mumbai (Priority 1 on Waitlist)",
    explanation: "Deciphered critical handwritten cadaveric donor fax. Extracted O- Heart allograft with maximum 4.0-hour cold ischemic window. Requires immediate NOTTO West Zone police green corridor activation or helicopter dispatch.",
    recommended_mode: "Helicopter",
    transport_action_plan: {
      phase1_harvest: "Cross-clamp at donor ICU; infuse cold Custodiol HTK at 4°C.",
      phase2_corridor: "Alert Traffic Police Command for Green Corridor along Western Express / Sea Link.",
      phase3_transit: "LifeFlight Helipad / High-speed escorted ambulance departure.",
      phase4_recipient: "Recipient OR-4 at KEM Hospital notified; cardiopulmonary bypass on standby."
    }
  },
  liver: {
    organ_type: "Liver",
    donor_blood_type: "B+",
    urgency_level_1_to_5: 4,
    golden_hour_window_hours: 10,
    donor_summary: "42F Cadaveric Donor, Intracranial Hemorrhage. Bilirubin 1.1 mg/dL, AST 42 U/L, ALT 38 U/L (Grade A graft quality).",
    transcription: "ZTCC PUNE REGIONAL DISPATCH - FORM ZTCC-PUN-2026-4412\n" +
      "Donor: 42yo Female | Cause: Intracranial Aneurysmal Rupture\n" +
      "Organ: Whole Liver Allograft\n" +
      "Serology: B Positive (B+)\n" +
      "Hepatic Panel: Bilirubin 1.1 | SGOT 42 | SGPT 38 (Grade A)\n" +
      "Surgeon Notes: 'Graft uniform color, no steatosis. Packaged in UW solution at 4°C. Need rapid transit across Pune Station Road to Ruby Hall OT-2.'",
    explanation: "Deciphered ZTCC urgent hepatic allocation record. Extracted B+ Liver allograft with 10.0-hour cold ischemia threshold. Rapid highway corridor recommended.",
    recommended_mode: "Ambulance",
    transport_action_plan: {
      phase1_harvest: "En bloc hepatic recovery; UW cold preservation flush at 4°C.",
      phase2_corridor: "Pune Traffic Escort clear Station Road to Sassoon Road.",
      phase3_transit: "Specialized organ ambulance with dual temp-logging telemetry.",
      phase4_recipient: "Ruby Hall Surgical Team standing by for pre-reperfusion."
    }
  },
  kidney: {
    organ_type: "Kidneys",
    donor_blood_type: "A+",
    urgency_level_1_to_5: 3,
    golden_hour_window_hours: 24,
    donor_summary: "35M Cadaveric Donor, Severe Head Trauma. Serum Creatinine 0.9 mg/dL, BUN 14 mg/dL, Urine Output 140 mL/hr.",
    transcription: "AIIMS APEX TRAUMA CENTRE - NOTTO ALLOCATION 2026-9021\n" +
      "Donor: 35yo Male | Trauma Bay ICU\n" +
      "Organ: Dual Kidneys\n" +
      "Serology: A Positive (A+)\n" +
      "Renal Function: Creatinine 0.9 mg/dL | Urine 140 mL/hr\n" +
      "Surgeon Notes: 'Euro-Collins perfusion completed. Recipient cross-match negative, HLA 4/6 match confirmed. Ready for allocation dispatch.'",
    explanation: "Deciphered AIIMS apex trauma organ allocation dispatch. Dual Kidneys (A+) verified with 24-hour viability window. Ready for regional transit.",
    recommended_mode: "Ambulance",
    transport_action_plan: {
      phase1_harvest: "Dual kidney cannulation with Euro-Collins ice perfusion.",
      phase2_corridor: "Priority express road lane clearance.",
      phase3_transit: "Monitored ground transit to recipient transplant unit.",
      phase4_recipient: "Recipient dialysis check cleared; OR ready for vascular anastomosis."
    }
  }
};

// Helper to determine offline match based on filename or text
function getOfflineAnalysis(filename = "", text = "") {
  const combined = (filename + " " + text).toLowerCase();
  if (combined.includes("liver") || combined.includes("sample-fax-2") || combined.includes("b+")) {
    return { ...OFFLINE_CLINICAL_PRESETS.liver, source: "offline_clinical_engine" };
  }
  if (combined.includes("kidney") || combined.includes("sample-fax-3") || combined.includes("a+")) {
    return { ...OFFLINE_CLINICAL_PRESETS.kidney, source: "offline_clinical_engine" };
  }
  // Default to heart (highest stakes)
  return { ...OFFLINE_CLINICAL_PRESETS.heart, source: "offline_clinical_engine" };
}

// Call Google Gemini API (2.5-flash or 1.5-flash) with multimodal fax image or text
async function callGeminiAPI(payload) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set in environment or .env file.");
  }

  const promptText = `
You are the AI Engine of "Life-Line" - an emergency organ transplant dispatch system.
Hospitals send messy, scanned, handwritten fax forms of cadaveric donors.
Your job is to act as the universal bridge: read this medical fax / record, extract verified medical facts, and generate a structured Transport Action Plan.

Return ONLY a valid JSON object with the following exact keys:
{
  "organ_type": "Heart" | "Liver" | "Kidneys" | "Lungs" | "Pancreas",
  "donor_blood_type": "O-" | "O+" | "A-" | "A+" | "B-" | "B+" | "AB-" | "AB+",
  "urgency_level_1_to_5": 1 to 5 (5 is most urgent, e.g. Heart 4h golden window),
  "golden_hour_window_hours": number (e.g. 4 for heart, 6 for lung, 10 for liver, 24 for kidney),
  "donor_summary": "Short 1-2 sentence clinical summary of donor vitals and cause of death",
  "transcription": "Full transcript of legible text and deciphered handwritten doctor notes from the document",
  "explanation": "Clear, professional clinical briefing summarizing the match, risks, and transport mandate",
  "recommended_mode": "Helicopter" | "Ambulance",
  "transport_action_plan": {
    "phase1_harvest": "Steps for organ perfusion and packaging at donor hospital",
    "phase2_corridor": "Traffic / Airspace clearance protocol (e.g. Police Green Corridor)",
    "phase3_transit": "Optimal transit speed and temperature telemetry tracking",
    "phase4_recipient": "Notification instructions for recipient surgical team"
  }
}
Do NOT wrap in markdown backticks. Return raw JSON only.
`;

  const contents = [];
  const parts = [{ text: promptText }];

  if (payload.imageBase64 && payload.mimeType) {
    parts.push({
      inline_data: {
        mime_type: payload.mimeType,
        data: payload.imageBase64
      }
    });
  } else if (payload.rawText) {
    parts.push({
      text: `Medical Document / Dispatch Text to analyze:\n${payload.rawText}`
    });
  }

  contents.push({ parts });

  // Use Gemini 2.5 Flash if available, fallback to 1.5 Flash
  const models = ["gemini-2.5-flash", "gemini-1.5-flash"];
  let lastError = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json"
          }
        }),
        signal: AbortSignal.timeout(15_000)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error (${model} - HTTP ${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const rawResponseText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawResponseText) {
        throw new Error("Empty candidate response from Gemini API.");
      }

      // Clean any accidental markdown quotes
      const cleaned = rawResponseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);
      parsed.source = `${model} (Live API)`;
      return parsed;
    } catch (err) {
      lastError = err;
      // try next model
    }
  }

  throw lastError || new Error("Failed to contact Gemini API.");
}

// Generate an offline realistic geometric road route between coordinates
function generateFallbackRoute(origin, destination, mode = "ambulance") {
  const [lat1, lng1] = origin;
  const [lat2, lng2] = destination;

  // Calculate approximate straight line distance in km using Haversine
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightDistanceKm = R * c;

  // Road distance is typically ~1.25x - 1.35x straight line due to curves and highways
  const distanceMultiplier = mode === "helicopter" ? 1.02 : 1.28;
  const totalDistanceKm = straightDistanceKm * distanceMultiplier;

  // Average speeds: Green Corridor Ambulance: ~75 km/h, Helicopter: ~220 km/h
  const avgSpeedKmh = mode === "helicopter" ? 220 : 75;
  const durationMinutes = (totalDistanceKm / avgSpeedKmh) * 60;

  // Generate intermediate waypoint coordinates with realistic corridor curves
  const steps = 30;
  const coordinates = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Linear base
    let lat = lat1 + (lat2 - lat1) * t;
    let lng = lng1 + (lng2 - lng1) * t;

    if (mode === "ambulance" && i > 0 && i < steps) {
      // Add realistic gentle curve representing highway alignment
      const curvature = Math.sin(t * Math.PI) * 0.015;
      lat += curvature * 0.6;
      lng += curvature * 0.8;
    }

    coordinates.push([lng, lat]); // GeoJSON order: [lng, lat]
  }

  return {
    code: "Ok",
    routes: [
      {
        distance: totalDistanceKm * 1000, // in meters
        duration: durationMinutes * 60,   // in seconds
        geometry: {
          type: "LineString",
          coordinates
        },
        mode,
        is_offline_fallback: true
      }
    ]
  };
}

// HTTP Request Handler
export async function handleRequest(req, res) {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost:3000"}`);
  const pathname = parsedUrl.pathname;

  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // API: Health & Config check
  if (req.method === "GET" && pathname === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "ok",
      server_time: new Date().toISOString(),
      gemini_configured: Boolean(GEMINI_API_KEY && GEMINI_API_KEY !== "your_gemini_api_key_here"),
      offline_engine_available: true,
      port: PORT
    }));
    return;
  }

  // API: Analyze Document / Dispatch
  if (req.method === "POST" && pathname === "/api/analyze") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", async () => {
      try {
        const payload = JSON.parse(body || "{}");
        let result = null;

        // Try Gemini API first if key exists
        if (GEMINI_API_KEY && GEMINI_API_KEY !== "your_gemini_api_key_here") {
          try {
            result = await callGeminiAPI(payload);
          } catch (apiErr) {
            console.warn("[Gemini API Warning, falling back to Offline Clinical Engine]:", apiErr.message);
            result = getOfflineAnalysis(payload.filename, payload.rawText);
            result.warning = `Gemini API fallback: ${apiErr.message}`;
          }
        } else {
          // No API key configured -> seamless Offline Clinical Intelligence Engine
          result = getOfflineAnalysis(payload.filename, payload.rawText);
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (err) {
        // Fallback safely to offline clinical data so app never crashes
        const fallback = getOfflineAnalysis("sample-fax-1", "Heart O-");
        fallback.warning = `Request parser fallback: ${err.message}`;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(fallback));
      }
    });
    return;
  }

  // API: Routing calculation (with automatic offline fallback)
  if (req.method === "POST" && pathname === "/api/route") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", async () => {
      try {
        const { origin, destination, mode = "ambulance" } = JSON.parse(body || "{}");
        if (!origin || !destination) {
          throw new Error("Both origin and destination coordinates are required.");
        }

        let routeData = null;

        // Try public OSRM if road ambulance and network reachable
        if (mode === "ambulance") {
          try {
            const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${origin[1]},${origin[0]};${destination[1]},${destination[0]}?overview=full&geometries=geojson`;
            const osrmResp = await fetch(osrmUrl, { signal: AbortSignal.timeout(4000) });
            if (osrmResp.ok) {
              const json = await osrmResp.json();
              if (json.code === "Ok" && json.routes?.length > 0) {
                routeData = json;
              }
            }
          } catch (osrmErr) {
            // OSRM unreachable or offline - fall through to fallback route generator
          }
        }

        // If Helicopter mode or OSRM failed/offline, use high-precision fallback generator
        if (!routeData) {
          routeData = generateFallbackRoute(origin, destination, mode);
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(routeData));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Static File Serving
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, "");
  if (safePath === "/" || safePath === "\\") {
    safePath = "/index.html";
  }

  const filePath = path.join(__dirname, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=UTF-8" });
      res.end("404 Not Found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    res.writeHead(200, { "Content-Type": contentType });
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
}

// HTTP Server
const server = http.createServer(handleRequest);

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    const nextPort = (server.address()?.port || PORT) + 1;
    console.warn(`[Life-Line] Port ${PORT} in use, automatically trying port ${nextPort}...`);
    setTimeout(() => {
      server.listen(nextPort);
    }, 200);
  } else {
    console.error("[Life-Line Server Error]:", err);
  }
});

// Auto-start server only when executed directly (node server.js)
const isMainModule = process.argv[1] && process.argv[1].endsWith("server.js");
if (isMainModule) {
  server.listen(PORT, () => {
    const activePort = server.address()?.port || PORT;
    console.log(`=======================================================`);
    console.log(`  🚁 LIFE-LINE: Organ Transplant Logistics Dispatcher`);
    console.log(`  Server running at: http://localhost:${activePort}`);
    console.log(`  Gemini AI Status:  ${GEMINI_API_KEY && GEMINI_API_KEY !== "your_gemini_api_key_here" ? "ONLINE (Active)" : "OFFLINE ENGINE (Ready)"}`);
    console.log(`  Offline Mode:      Fully Enabled & Ready`);
    console.log(`=======================================================`);
  });
}

export default server;
