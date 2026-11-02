import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";

const source = await readFile("public/receipt/sample.html", "utf8");
const html = source.replaceAll("/fonts/", "./fonts/").replaceAll("/shared/", "./shared/");
await mkdir("docs/shared", { recursive: true });
await mkdir("docs/fonts", { recursive: true });
await writeFile("docs/index.html", html, "utf8");
await copyFile("public/shared/lamp.js", "docs/shared/lamp.js");
await copyFile("public/fonts/SpaceGrotesk-wght.woff2", "docs/fonts/SpaceGrotesk-wght.woff2");
await copyFile("public/fonts/OFL.txt", "docs/fonts/OFL.txt");
console.log("[export] wrote GitHub Pages receipt to docs/");
