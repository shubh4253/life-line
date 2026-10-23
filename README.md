# Life-Line

## Run locally

1. Install Node.js 22.9 or newer.
2. Run `npm start` in this folder. The server starts even when `.env` has not been created yet.
3. Open the URL printed by the server (by default, `http://localhost:3000`). Do not use the VS Code Live Server URL; it does not provide the image-analysis API.
4. To enable image analysis, copy `.env.example` to `.env`, replace the placeholder with your Gemini API key, then stop and restart the server. Without a configured key, the page loads normally and shows a setup message when analysis is requested.

The API key stays on the server and is not included in browser JavaScript. Uploaded images are sent to the Gemini API configured by that key. Only upload medical documents when you are authorized to share them with that service and its data handling meets your privacy requirements.

After analysis, select **Use my current location** and allow browser location access to route to the matched demo hospital. The browser sends your coordinates to the public OSRM routing service. The displayed route is the shortest-distance option among the alternatives returned by OSRM; traffic is not included. Routing requires an internet connection.

The recipient registry and map routing are mock data for demonstration only, not NOTTO data, emergency dispatch guidance, or a validated medical transport route. AI transcriptions and rewritten explanations can contain errors and must be verified against the original document by a qualified professional.
