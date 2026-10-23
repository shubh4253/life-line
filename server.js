import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDirectory = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
const MODEL_NAME = "gemini-3.8-flash";
const maxImageBytes = 7 * 1024 * 1024;
const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const staticFiles = new Map([
    ["/", ["index.html", "text/html; charset=utf-8"]],
    ["/index.html", ["index.html", "text/html; charset=utf-8"]],
    ["/style.css", ["style.css", "text/css; charset=utf-8"]],
    ["/gemini.js", ["gemini.js", "text/javascript; charset=utf-8"]],
    ["/logistics.js", ["logistics.js", "text/javascript; charset=utf-8"]]
]);

function sendJson(response, statusCode, body) {
    response.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
    });
    response.end(JSON.stringify(body));
}

async function readJsonBody(request, limit) {
    const chunks = [];
    let size = 0;

    for await (const chunk of request) {
        size += chunk.length;
        if (size > limit) {
            const error = new Error("Request body exceeds the size limit.");
            error.statusCode = 413;
            throw error;
        }
        chunks.push(chunk);
    }

    try {
        return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
        const error = new Error("Request body must be valid JSON.");
        error.statusCode = 400;
        throw error;
    }
}

function validateAnalysis(analysis) {
    if (!analysis || typeof analysis !== "object") return false;

    return (
        typeof analysis.transcription === "string" &&
        analysis.transcription.trim().length > 0 &&
        typeof analysis.explanation === "string" &&
        analysis.explanation.trim().length > 0 &&
        typeof analysis.organ_type === "string" &&
        typeof analysis.blood_type === "string" &&
        Number.isInteger(analysis.urgency_level_1_to_5) &&
        analysis.urgency_level_1_to_5 >= 0 &&
        analysis.urgency_level_1_to_5 <= 5
    );
}

async function analyzeImage({ mimeType, imageData }) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        const error = new Error("Gemini is not configured. Set GEMINI_API_KEY in the server's .env file.");
        error.statusCode = 503;
        throw error;
    }

    if (!allowedMimeTypes.has(mimeType)) {
        const error = new Error("Unsupported image type. Use a JPG, PNG, or WebP image.");
        error.statusCode = 400;
        throw error;
    }

    if (
        typeof imageData !== "string" ||
        imageData.length === 0 ||
        imageData.length > Math.ceil(maxImageBytes * 4 / 3) + 4 ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(imageData) ||
        imageData.length % 4 !== 0
    ) {
        const error = new Error("The image data is missing or invalid.");
        error.statusCode = 400;
        throw error;
    }

    const imageBuffer = Buffer.from(imageData, "base64");
    if (imageBuffer.length === 0 || imageBuffer.length > maxImageBytes) {
        const error = new Error("Image is too large or empty. Choose an image smaller than 7 MB.");
        error.statusCode = 400;
        throw error;
    }

    let apiResponse;
    try {
        apiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${encodeURIComponent(apiKey)}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                signal: AbortSignal.timeout(60_000),
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            {
                                text: [
                                    "Read the provided medical document image. Transcribe all visible text faithfully, preserving its labels and line breaks where practical.",
                                    "Then rewrite the document's content as a clear, easy-to-understand explanation. Explain medical abbreviations or terms in plain language when their meaning is clear from the document. Preserve every important stated fact, value, date, instruction, and uncertainty; do not merely give a short summary, and do not add facts that are not present. Clearly mark any text you cannot read.",
                                    "Extract organ_type, blood_type, and urgency_level_1_to_5 only when clearly stated in the document. Never infer missing medical details. Use 'Not specified' for unknown organ_type or blood_type, and 0 for unknown urgency.",
                                    "Do not provide a diagnosis or treatment recommendation. Return only JSON matching the requested schema."
                                ].join(" ")
                            },
                            { inline_data: { mime_type: mimeType, data: imageData } }
                        ]
                    }],
                    generationConfig: {
                        responseMimeType: "application/json",
                        responseSchema: {
                            type: "OBJECT",
                            properties: {
                                transcription: { type: "STRING" },
                                explanation: { type: "STRING" },
                                organ_type: { type: "STRING" },
                                blood_type: { type: "STRING" },
                                urgency_level_1_to_5: { type: "INTEGER" }
                            },
                            required: [
                                "transcription",
                                "explanation",
                                "organ_type",
                                "blood_type",
                                "urgency_level_1_to_5"
                            ]
                        }
                    }
                })
            }
        );
    } catch (error) {
        console.error("Could not reach the Gemini API.", error);
        const isTimeout = error.name === "TimeoutError";
        const apiError = new Error(isTimeout
            ? "Gemini took too long to respond. Try again with a smaller image."
            : "Could not connect to Gemini. Check your internet connection and try again.");
        apiError.statusCode = 502;
        throw apiError;
    }

    if (!apiResponse.ok) {
        const responseText = await apiResponse.text();
        let providerMessage = "";
        try {
            providerMessage = JSON.parse(responseText).error?.message || "";
        } catch {
            providerMessage = "";
        }
        console.error(`Gemini API request failed with HTTP ${apiResponse.status}.`);
        const error = new Error(providerMessage
            ? `Gemini could not analyze this image: ${providerMessage}`
            : "Gemini could not analyze this image. Check that your API key is valid and enabled for the Gemini API.");
        error.statusCode = 502;
        throw error;
    }

    let apiResult;
    try {
        apiResult = await apiResponse.json();
    } catch {
        console.error("Gemini API returned an empty or invalid JSON response.");
        const error = new Error("Gemini returned an empty or invalid response. Please try again.");
        error.statusCode = 502;
        throw error;
    }
    const responseText = apiResult.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("");

    if (typeof responseText !== "string" || responseText.length === 0) {
        console.error("Gemini API returned no analysis text.");
        const error = new Error("The Gemini API returned no analysis. Try a clearer image.");
        error.statusCode = 502;
        throw error;
    }

    let analysis;
    try {
        analysis = JSON.parse(responseText);
    } catch {
        console.error("Gemini API returned malformed analysis JSON.");
        const error = new Error("The Gemini API returned an unreadable result. Please try again.");
        error.statusCode = 502;
        throw error;
    }

    if (!validateAnalysis(analysis)) {
        console.error("Gemini API returned analysis that did not match the expected format.");
        const error = new Error("The Gemini API returned incomplete analysis. Please try again.");
        error.statusCode = 502;
        throw error;
    }

    return analysis;
}

const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);

    if (requestUrl.pathname === "/api/status") {
        if (request.method !== "GET") {
            response.setHeader("Allow", "GET");
            sendJson(response, 405, { error: "Use GET to check server status." });
            return;
        }

        sendJson(response, 200, { configured: Boolean(process.env.GEMINI_API_KEY) });
        return;
    }

    if (requestUrl.pathname === "/api/analyze") {
        if (request.method !== "POST") {
            response.setHeader("Allow", "POST");
            sendJson(response, 405, { error: "Use POST to analyze an image." });
            return;
        }

        if (!request.headers["content-type"]?.includes("application/json")) {
            sendJson(response, 415, { error: "Request must use application/json." });
            return;
        }

        try {
            const body = await readJsonBody(request, Math.ceil(maxImageBytes * 4 / 3) + 16_384);
            const analysis = await analyzeImage(body);
            sendJson(response, 200, analysis);
        } catch (error) {
            const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
            if (statusCode === 500) {
                console.error("Image analysis failed unexpectedly.", error);
            }
            sendJson(response, statusCode, {
                error: statusCode === 500 ? "An unexpected server error occurred." : error.message
            });
        }
        return;
    }

    const asset = staticFiles.get(requestUrl.pathname);
    if (!asset || !["GET", "HEAD"].includes(request.method)) {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
    }

    try {
        const content = await readFile(path.join(projectDirectory, asset[0]));
        response.writeHead(200, {
            "Content-Type": asset[1],
            "X-Content-Type-Options": "nosniff"
        });
        response.end(request.method === "HEAD" ? undefined : content);
    } catch (error) {
        console.error(`Could not serve ${asset[0]}.`, error);
        response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Could not serve the requested file.");
    }
});

server.listen(port, () => {
    console.log(`Life-Line app is running at http://localhost:${port}`);
});
