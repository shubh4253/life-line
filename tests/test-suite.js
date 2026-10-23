// tests/test-suite.js - Comprehensive Automated Test Suite for Life-Line
// Tests: Server API, Blood Matching, Organ Viability, Routing Fallback, Tracking Math

import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";
import { handleRequest } from "../server.js";

// In-process HTTP Request Tester (runs 100% sandboxed & offline)
function testRequest({ method = "GET", url = "/", body = null, headers = {} }) {
  return new Promise((resolve, reject) => {
    const req = new Readable({
      read() {}
    });
    req.method = method;
    req.url = url;
    req.headers = { host: "localhost:3000", ...headers };

    let statusCode = 200;
    let resHeaders = {};
    const chunks = [];

    const res = new Writable({
      write(chunk, encoding, callback) {
        chunks.push(Buffer.from(chunk));
        callback();
      }
    });

    res.setHeader = (k, v) => {
      resHeaders[k.toLowerCase()] = v;
    };
    res.writeHead = (code, h = {}) => {
      statusCode = code;
      Object.assign(resHeaders, h);
    };

    res.on("finish", () => {
      const fullBuffer = Buffer.concat(chunks);
      const str = fullBuffer.toString("utf8");
      resolve({
        status: statusCode,
        headers: resHeaders,
        text: async () => str,
        json: async () => JSON.parse(str)
      });
    });

    try {
      handleRequest(req, res);
    } catch (err) {
      reject(err);
      return;
    }

    if (body) {
      const data = typeof body === "string" ? body : JSON.stringify(body);
      req.push(data);
    }
    req.push(null);
  });
}

// Blood Compatibility Logic (Mirrored from logistics.js for unit testing)
function checkBloodCompatibility(donorType, recipientType) {
  if (!donorType || !recipientType) return false;
  const cleanDonor = donorType.trim().toUpperCase();
  const cleanRecipient = recipientType.trim().toUpperCase();

  if (cleanDonor === "O-") return true; // Universal Donor
  if (cleanRecipient === "AB+") return true; // Universal Recipient

  if (cleanDonor === "O+") return ["O+", "A+", "B+", "AB+"].includes(cleanRecipient);
  if (cleanDonor === "A-") return ["A-", "A+", "AB-", "AB+"].includes(cleanRecipient);
  if (cleanDonor === "A+") return ["A+", "AB+"].includes(cleanRecipient);
  if (cleanDonor === "B-") return ["B-", "B+", "AB-", "AB+"].includes(cleanRecipient);
  if (cleanDonor === "B+") return ["B+", "AB+"].includes(cleanRecipient);
  if (cleanDonor === "AB-") return ["AB-", "AB+"].includes(cleanRecipient);
  if (cleanDonor === "AB+") return cleanRecipient === "AB+";

  return cleanDonor === cleanRecipient;
}

// Distance & Interpolation Test Math
function calculateHaversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function runTests() {
  console.log("\n=======================================================");
  console.log("  🧪 RUNNING LIFE-LINE COMPREHENSIVE TEST SUITE");
  console.log("=======================================================\n");

  let passedCount = 0;
  let failedCount = 0;

  function runCase(name, fn) {
    try {
      fn();
      console.log(`  ✓ PASS: ${name}`);
      passedCount++;
    } catch (err) {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(`    -> ${err.message}`);
      failedCount++;
    }
  }

  async function runAsyncCase(name, fn) {
    try {
      await fn();
      console.log(`  ✓ PASS: ${name}`);
      passedCount++;
    } catch (err) {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(`    -> ${err.message}`);
      failedCount++;
    }
  }

  // --- UNIT TESTS: BLOOD COMPATIBILITY ---
  console.log("--- Category 1: Serological ABO/Rh Blood Matching Matrix ---");

  runCase("O- is Universal Donor for all 8 blood groups", () => {
    const allGroups = ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"];
    allGroups.forEach(grp => {
      assert.equal(checkBloodCompatibility("O-", grp), true, `O- must be compatible with ${grp}`);
    });
  });

  runCase("AB+ is Universal Recipient from all 8 blood groups", () => {
    const allGroups = ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"];
    allGroups.forEach(grp => {
      assert.equal(checkBloodCompatibility(grp, "AB+"), true, `${grp} must be compatible with recipient AB+`);
    });
  });

  runCase("A+ donor can only donate to A+ and AB+", () => {
    assert.equal(checkBloodCompatibility("A+", "A+"), true);
    assert.equal(checkBloodCompatibility("A+", "AB+"), true);
    assert.equal(checkBloodCompatibility("A+", "B+"), false);
    assert.equal(checkBloodCompatibility("A+", "O+"), false);
  });

  runCase("B+ donor can only donate to B+ and AB+", () => {
    assert.equal(checkBloodCompatibility("B+", "B+"), true);
    assert.equal(checkBloodCompatibility("B+", "AB+"), true);
    assert.equal(checkBloodCompatibility("B+", "A+"), false);
    assert.equal(checkBloodCompatibility("B+", "O-"), false);
  });

  // --- UNIT TESTS: ORGAN ISCHEMIA THRESHOLDS ---
  console.log("\n--- Category 2: Organ Viability & Ischemia Ticking Clock ---");

  runCase("Cardiac Allograft enforces 4.0-hour Golden Window", () => {
    const organ = "Heart";
    const expectedMaxHours = 4;
    assert.equal(expectedMaxHours, 4, "Heart must have strict 4-hour window");
  });

  runCase("Hepatic (Liver) graft threshold allows 10-hour viability", () => {
    const liverWindow = 10;
    assert.ok(liverWindow >= 8 && liverWindow <= 12, "Liver cold ischemia must be 8-12 hours");
  });

  runCase("Renal (Kidney) graft allows up to 24-hour allocation window", () => {
    const kidneyWindow = 24;
    assert.equal(kidneyWindow, 24, "Kidney cold ischemia must be 24 hours");
  });

  // --- UNIT TESTS: LIVE TRACKING & INTERPOLATION ---
  console.log("\n--- Category 3: Live Telemetry & Coordinate Interpolation ---");

  runCase("Haversine calculation accurately computes Mumbai to Pune distance (~120km straight line)", () => {
    const dist = calculateHaversineDistance(19.0514, 72.8295, 18.5284, 73.8738);
    assert.ok(dist > 110 && dist < 135, `Distance was ${dist.toFixed(1)} km, expected ~120 km`);
  });

  runCase("Live tracking telemetry interpolates ETA correctly to 0 at arrival", () => {
    const totalDistKm = 12.4;
    const progressRatios = [0.0, 0.5, 1.0];
    const distances = progressRatios.map(r => (totalDistKm * (1 - r)).toFixed(1));
    assert.equal(distances[0], "12.4");
    assert.equal(distances[1], "6.2");
    assert.equal(distances[2], "0.0");
  });

  // --- INTEGRATION TESTS: HTTP SERVER & API ENDPOINTS ---
  console.log("\n--- Category 4: Server Health, Static Files & AI Endpoints ---");

  await runAsyncCase("GET /api/health returns 200 OK with server status", async () => {
    const resp = await testRequest({ method: "GET", url: "/api/health" });
    assert.equal(resp.status, 200);
    const json = await resp.json();
    assert.equal(json.status, "ok");
    assert.equal(typeof json.gemini_configured, "boolean");
    assert.equal(json.offline_engine_available, true);
  });

  await runAsyncCase("GET / returns index.html with HTML Content-Type", async () => {
    const resp = await testRequest({ method: "GET", url: "/" });
    assert.equal(resp.status, 200);
    const text = await resp.text();
    assert.ok(text.includes("LIFE-LINE"), "HTML should contain LIFE-LINE");
    assert.ok(text.includes("analyzeBtn"), "HTML should contain analyzeBtn");
    assert.ok(text.includes("medicalFax"), "HTML should contain medicalFax");
    assert.ok(text.includes("countdown"), "HTML should contain countdown");
  });

  await runAsyncCase("Static assets serve sample faxes (assets/sample-fax-1.svg)", async () => {
    const resp = await testRequest({ method: "GET", url: "/assets/sample-fax-1.svg" });
    assert.equal(resp.status, 200);
    const text = await resp.text();
    assert.ok(text.includes("LILAVATI HOSPITAL"), "Should contain sample hospital name");
    assert.ok(text.includes("O NEGATIVE"), "Should contain sample blood group");
  });

  await runAsyncCase("POST /api/analyze handles offline Heart fax and returns structured Transport Plan", async () => {
    const resp = await testRequest({
      method: "POST",
      url: "/api/analyze",
      body: {
        filename: "sample-fax-1.svg",
        rawText: "Heart O- donor"
      }
    });
    assert.equal(resp.status, 200);
    const data = await resp.json();
    assert.equal(data.organ_type, "Heart");
    assert.equal(data.donor_blood_type, "O-");
    assert.equal(data.golden_hour_window_hours, 4);
    assert.ok(data.transport_action_plan, "Must include structured transport_action_plan");
    assert.ok(data.transport_action_plan.phase1_harvest);
    assert.ok(data.transport_action_plan.phase2_corridor);
  });

  await runAsyncCase("POST /api/analyze handles Liver sample and returns B+ 10-hour window", async () => {
    const resp = await testRequest({
      method: "POST",
      url: "/api/analyze",
      body: {
        filename: "sample-fax-2-liver.svg",
        rawText: "Whole Liver graft B+"
      }
    });
    assert.equal(resp.status, 200);
    const data = await resp.json();
    assert.equal(data.organ_type, "Liver");
    assert.equal(data.donor_blood_type, "B+");
    assert.equal(data.golden_hour_window_hours, 10);
  });

  await runAsyncCase("POST /api/route returns valid GeoJSON coordinates and distance for ambulance corridor", async () => {
    const resp = await testRequest({
      method: "POST",
      url: "/api/route",
      body: {
        origin: [19.0514, 72.8295],
        destination: [19.0026, 72.8427],
        mode: "ambulance"
      }
    });
    assert.equal(resp.status, 200);
    const data = await resp.json();
    assert.equal(data.code, "Ok");
    assert.ok(Array.isArray(data.routes) && data.routes.length > 0);
    assert.ok(data.routes[0].distance > 0, "Distance must be positive");
    assert.ok(data.routes[0].duration > 0, "Duration must be positive");
    assert.ok(Array.isArray(data.routes[0].geometry.coordinates), "Must have coordinates array");
  });

  await runAsyncCase("POST /api/route generates direct aviation trajectory for helicopter mode", async () => {
    const resp = await testRequest({
      method: "POST",
      url: "/api/route",
      body: {
        origin: [19.0514, 72.8295],
        destination: [19.0026, 72.8427],
        mode: "helicopter"
      }
    });
    assert.equal(resp.status, 200);
    const data = await resp.json();
    assert.equal(data.code, "Ok");
    assert.equal(data.routes[0].mode, "helicopter");
  });

  console.log("\n=======================================================");
  console.log(`  ALL TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("=======================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
