import { existsSync } from "fs";
import path from "path";
import puppeteer from "puppeteer";

function findBrowser(): string | undefined {
  const candidates = [
    `${process.env.LOCALAPPDATA}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`,
    "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

const PDF_NAME = process.argv[2] ?? "test-t7-filled.pdf";
const OUT_NAME = process.argv[3] ?? "t7-filled-check.png";

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
  const viewport = pdfPage.getViewport({ scale: 2.5 });
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
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: findBrowser(),
    args: ["--allow-file-access-from-files"],
  });
  const page = await browser.newPage();
  const htmlPath = path.resolve("t7-render.html");
  const { writeFileSync } = await import("fs");
  writeFileSync(htmlPath, HTML);
  await page.goto(`file:///${htmlPath.replace(/\\/g, "/")}`);
  await page.waitForFunction('document.title === "render-done"', {
    timeout: 30000,
  });
  const canvas = await page.$("#c");
  await canvas!.screenshot({ path: OUT_NAME });
  await browser.close();
  console.log(`wrote ${OUT_NAME}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
