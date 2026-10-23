import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDirectory = path.dirname(fileURLToPath(import.meta.url));
const outputDirectory = path.join(projectDirectory, "public");
const staticFiles = ["index.html", "style.css", "gemini.js", "logistics.js"];

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

for (const file of staticFiles) {
    await cp(path.join(projectDirectory, file), path.join(outputDirectory, file));
}

console.log(`Copied ${staticFiles.length} static files to public/`);
