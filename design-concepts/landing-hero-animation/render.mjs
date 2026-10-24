import { chromium } from "playwright-core";
import gifenc from "gifenc";
const { GIFEncoder, quantize, applyPalette } = gifenc;
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const HTML = process.argv[2];
const OUT = process.argv[3];
const FRAMES = Number(process.argv[4] || 80);
const DELAY = Number(process.argv[5] || 50); // ms per frame

const exe = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.addInitScript(() => { window.__CAPTURE__ = true; });
await page.goto(pathToFileURL(HTML).href);
await page.waitForFunction(() => typeof window.renderFrame === "function");

const W = await page.evaluate(() => window.__W);
const H = await page.evaluate(() => window.__H);
console.log(`canvas ${W}x${H}, ${FRAMES} frames`);

const gif = GIFEncoder();

for (let i = 0; i < FRAMES; i++) {
  const phase = i / FRAMES;
  // Draw the exact phase, then pull raw RGBA pixels straight off the canvas.
  const b64 = await page.evaluate((p) => {
    window.renderFrame(p);
    const c = document.getElementById("stage");
    const ctx = c.getContext("2d");
    const img = ctx.getImageData(0, 0, c.width, c.height).data;
    let bin = "";
    const chunk = 0x8000;
    for (let i = 0; i < img.length; i += chunk) {
      bin += String.fromCharCode.apply(null, img.subarray(i, i + chunk));
    }
    return btoa(bin);
  }, phase);

  const rgba = new Uint8Array(Buffer.from(b64, "base64"));
  const palette = quantize(rgba, 256, { format: "rgb444" });
  const index = applyPalette(rgba, palette, "rgb444");
  gif.writeFrame(index, W, H, { palette, delay: DELAY });
  process.stdout.write(`\rframe ${i + 1}/${FRAMES}`);
}

gif.finish();
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, gif.bytes());
console.log(`\nwrote ${OUT} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`);

await browser.close();
