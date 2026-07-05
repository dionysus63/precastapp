import { existsSync, writeFileSync } from "fs";
import path from "path";
import puppeteer from "puppeteer";

const PDF_NAME = process.argv[2] ?? "test-t7-filled.pdf";
const OUT_PREFIX = process.argv[3] ?? "t7";

function findBrowser(): string | undefined {
  const candidates = [
    `${process.env.LOCALAPPDATA}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`,
    "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

const HTML = `<!doctype html>
<html>
<body style="margin:0">
<canvas id="c"></canvas>
<script type="module">
  import * as pdfjs from "./node_modules/pdfjs-dist/build/pdf.min.mjs";
  pdfjs.GlobalWorkerOptions.workerSrc = "./public/pdf.worker.min.mjs";
  const bytes = await fetch("./${PDF_NAME}").then(r => r.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  const pdfPage = await pdf.getPage(1);
  const viewport = pdfPage.getViewport({ scale: 6 });
  const canvas = document.getElementById("c");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await pdfPage.render({ canvasContext: ctx, viewport, canvas }).promise;
  document.title = "render-done";
</script>
</body>
</html>`;

async function main() {
  writeFileSync("t7-render-zoom.html", HTML);
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: findBrowser(),
    args: ["--allow-file-access-from-files"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 3800, height: 4900 });
  await page.goto(
    `file:///${path.resolve("t7-render-zoom.html").replace(/\\/g, "/")}`,
  );
  await page.waitForFunction('document.title === "render-done"', {
    timeout: 60000,
  });
  // Page is 612x792 pt at scale 6 => 3672 x 4752 px. PDF y goes up; screen y down.
  await page.screenshot({
    path: `${OUT_PREFIX}-zoom-header.png`,
    clip: { x: 150, y: 580, width: 1800, height: 620 },
  });
  await page.screenshot({
    path: `${OUT_PREFIX}-zoom-table.png`,
    clip: { x: 150, y: 3000, width: 2000, height: 1600 },
  });
  await page.screenshot({
    path: `${OUT_PREFIX}-zoom-rim.png`,
    clip: { x: 1850, y: 2950, width: 1820, height: 1600 },
  });
  await browser.close();
  console.log(
    `wrote ${OUT_PREFIX}-zoom-header.png, ${OUT_PREFIX}-zoom-table.png, ${OUT_PREFIX}-zoom-rim.png`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
