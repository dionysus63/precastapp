import { existsSync, writeFileSync } from "fs";
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

const HTML_PATH = path.resolve("render-arrow-check.html");

const HTML = `<!doctype html>
<html>
<body style="margin:0">
<canvas id="c"></canvas>
<script type="module">
  import * as pdfjs from "./node_modules/pdfjs-dist/build/pdf.min.mjs";
  pdfjs.GlobalWorkerOptions.workerSrc = "./public/pdf.worker.min.mjs";
  const bytes = await fetch("./test-template-arrows.pdf").then(r => r.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  const pdfPage = await pdf.getPage(1);
  const viewport = pdfPage.getViewport({ scale: 3 });
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
  writeFileSync(HTML_PATH, HTML);

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: findBrowser(),
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--allow-file-access-from-files",
    ],
  });
  try {
    const page = await browser.newPage();
    page.on("pageerror", (err) => console.error("pageerror:", err.message));
    page.on("console", (msg) => console.log("console:", msg.text()));
    await page.goto(`file:///${HTML_PATH.replace(/\\/g, "/")}`);
    await page.waitForFunction('document.title === "render-done"', {
      timeout: 30000,
    });

    const canvas = await page.$("#c");
    if (!canvas) throw new Error("canvas not found");
    await canvas.screenshot({ path: "arrow-check-full.png" });

    // Crop around the plan circle (marker rect x 84.7-261, y 337.7-513.2 in
    // PDF coords; PDF page is 612x792, scale 3, y flipped).
    const scale = 3;
    const clip = {
      x: (84.7 - 60) * scale,
      y: (792 - 513.2 - 60) * scale,
      width: (261 - 84.7 + 120) * scale,
      height: (513.2 - 337.7 + 120) * scale,
    };
    await page.screenshot({ path: "arrow-check-circle.png", clip });

    // Close-ups: template outlet arrow (top of circle) vs generated arrow B
    // (right of circle). Circle center is (172.8, 425) PDF pts, radius 87.
    await page.screenshot({
      path: "arrow-A-outlet.png",
      clip: {
        x: (172.8 - 45) * scale,
        y: (792 - 425 - 87 - 55) * scale,
        width: 100 * scale,
        height: 100 * scale,
      },
    });
    await page.screenshot({
      path: "arrow-B-generated.png",
      clip: {
        x: (172.8 + 87 - 55) * scale,
        y: (792 - 425 - 50) * scale,
        width: 100 * scale,
        height: 100 * scale,
      },
    });
    console.log("wrote arrow-check PNGs");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
