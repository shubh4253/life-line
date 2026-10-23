# 🚁 LIFE-LINE: Organ Transplant Logistics & Golden Hour Orchestrator
> **Societal Benefit Hackathon Submission**  
> *The Universal Bridge between messy, real-world medical data and life-saving transport systems.*

---

## 🌟 The Problem & Societal Impact
When a cadaveric organ donor passes away, transplant teams face a strictly ticking **"Golden Window"**:
- **Heart:** 4.0 Hours Max Cold Ischemic Time
- **Liver:** 8–10 Hours Max
- **Kidneys:** 24 Hours Max

Despite modern medicine, hospitals still heavily rely on **unstructured, messy, handwritten fax forms** sent between regional transplant coordinators (NOTTO/ZTCC). Simultaneously, ground ambulances face dense city traffic bottlenecks, and flight teams must coordinate airspace clearance.

A 20-minute delay or misread blood group on a handwritten fax can mean the loss of both the donor organ and the recipient's life.

---

## ⚡ The Gemini Bridge Solution
**Life-Line** acts as the mission-critical orchestrator:
1. **Messy Input Ingest:** Takes real-world scanned faxes, messy handwritten surgeon notes, or emergency radio voice dispatches.
2. **Gemini Multimodal AI / Clinical Engine:** Instantly deciphers handwritten clinical notes, extracts verified ABO/Rh blood groups, hemodynamics (MAP, LVEF, LFTs), and ischemia limits.
3. **Structured Transport Action Plan:** Generates a 4-phase clinical mission plan:
   - **Phase 1 (Harvest):** Organ recovery and cold perfusion buffer.
   - **Phase 2 (Corridor):** State Police Traffic Escort clearance along highway arterial checkpoints.
   - **Phase 3 (Transit):** Real-time GPS corridor tracking with live speed, distance, and ETA telemetry.
   - **Phase 4 (Recipient OT):** Recipient surgical suite pre-reperfusion notification.
4. **Live Telemetry & Tracking Simulation:** Interactive map visualization with an animated ambulance 🚑 or helicopter 🚁 progressing along the route, with live waypoint milestones and telemetry HUD.
5. **100% Offline Capability:** Operates both with live Gemini 2.5 Flash API (when online) and seamlessly falls back to a built-in offline clinical intelligence engine if internet or API keys are unavailable.

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js 22.9 or newer (uses native fetch and zero external npm packages).

### 1. Run the Server
In the project directory:
```bash
npm start
```
Open **`http://localhost:3000`** in your browser.

*(If port 3000 is occupied by another service on your machine, Life-Line automatically detects this and binds to the next available port, e.g. 3001).*

### 2. (Optional) Configure Gemini API Key
To enable live multimodal analysis via Google Gemini:
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Insert your Gemini API key from [Google AI Studio](https://aistudio.google.com/):
   ```env
   GEMINI_API_KEY=your_key_here
   PORT=3000
   ```
3. Restart the server (`npm start`).

> **Note:** If `.env` is absent or without a key, Life-Line automatically switches to its **Offline Clinical Intelligence Engine**, allowing full offline demonstrations, presentations, and testing!

---

## 🧪 Automated Test Suite
To run all 16 automated test cases covering Serological ABO Matching, Ischemia Timers, Server Endpoints, and Live Tracking Math:

```bash
npm test
```

### Verified Test Categories:
- **Category 1: Serological ABO/Rh Blood Matching Matrix** (Universal donor O-, universal recipient AB+, subgroup matching).
- **Category 2: Organ Viability & Ischemia Ticking Clock** (Cardiac 4h window, Hepatic 10h window, Renal 24h window).
- **Category 3: Live Telemetry & Coordinate Interpolation** (Haversine geodesic math, real-time ETA decay).
- **Category 4: Server Health, Static Files & AI Endpoints** (`/api/health`, `/api/analyze`, `/api/route`, static file delivery).

---

## 🎮 How to Demo Life-Line for Judges

1. **One-Click Messy Presets:**
   - Click any sample button under **1. Messy Data Ingest**:
     - `Heart (O-)`: 4h Golden Window, cadaveric donor with severe TBI.
     - `Liver (B+)`: 10h Viability threshold, ZTCC Pune transfer.
     - `Kidneys (A+)`: 24h allocation dispatch from AIIMS New Delhi.
2. **Emergency Radio Dispatch (Voice Input):**
   - Click `🎙️ Simulate Emergency Radio Dispatch` to test unstructured messy spoken input converted into clinical actions.
3. **Select Origin & Transport Mode:**
   - Choose origin hospital (`Lilavati Hospital, Mumbai`, `Sassoon General, Pune`, or `AIIMS, New Delhi`) or click `📍 Use my GPS Location`.
   - Toggle between `🚑 Green Corridor (Road)` and `🚁 LifeFlight Air Ambulance`.
4. **Analyze & Generate Transport Plan:**
   - Click `ANALYZE & GENERATE TRANSPORT PLAN`.
   - Watch Gemini decipher the handwritten notes, extract serology, and verify donor-recipient compatibility.
   - The **Golden Hour Ticking Clock** begins counting down the exact ischemic limit.
5. **Launch Live Tracking Simulation:**
   - Click `▶ Start Live Tracking`.
   - Watch the animated vehicle navigate the transit corridor in real time!
   - Telemetry HUD updates speed, remaining distance, ETA, and live waypoint milestones.
   - Test speed controls (`5x Speed`, `10x Speed`, `Pause`, `↺ Reset`).
6. **Export Transport Action Plan:**
   - Click `📋 Export Action Plan` to download the verified surgical handover document.

---

## 🛡️ Architecture & Technical Highlights
- **Zero External Dependencies:** Built with pure, modern Node.js standards (`node:http`, `node:fs`, `node:stream`). No bulky `node_modules` required to run!
- **Resilient Multi-Layer Routing:** Tries server route handler, live OSRM highway routing when connected, and intelligent geometric curvature fallback when offline.
- **Fail-Safe Privacy:** No patient data is permanently retained; API keys reside solely on the server environment.
