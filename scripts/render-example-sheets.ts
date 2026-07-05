import { copyFileSync, existsSync, writeFileSync } from "fs";
import path from "path";
import puppeteer from "puppeteer";

const EXAMPLES = [
  {
    src: "test-t3-filled.pdf",
    local: "test-t3-filled.pdf",
    out: "t3-filled.png",
  },
];

function findBrowser(): string | undefined {
  const candidates = [
    `${process.env.LOCALAPPDATA}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`,
    "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

const HTML = (pdfName: string) => `<!doctype html>
<html>
<body style="margin:0">
<canvas id="c"></canvas>
<script type="module">
  import * as pdfjs from "./node_modules/pdfjs-dist/build/pdf.min.mjs";
  pdfjs.GlobalWorkerOptions.workerSrc = "./public/pdf.worker.min.mjs";
  const bytes = await fetch("./${pdfName}").then(r => r.arrayBuffer());
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
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--allow-file-access-from-files",
    ],
  });
  try {
    for (const example of EXAMPLES) {
      copyFileSync(example.src, example.local);
      const htmlPath = path.resolve("render-example.html");
      writeFileSync(htmlPath, HTML(example.local));
      const page = await browser.newPage();
      await page.goto(`file:///${htmlPath.replace(/\\/g, "/")}`);
      await page.waitForFunction('document.title === "render-done"', {
        timeout: 30000,
      });
      const canvas = await page.$("#c");
      if (!canvas) throw new Error("canvas not found");
      await canvas.screenshot({ path: example.out });
      // Crop of the cross-section area (right-bottom quadrant of the sheet).
      const scale = 2.5;
      await page.screenshot({
        path: example.out.replace(".png", "-xsection.png"),
        clip: {
          x: 400 * scale,
          y: (792 - 380) * scale,
          width: 212 * scale,
          height: 340 * scale,
        },
      });
      // Tight crop on the wall joints (middle of the cross-section).
      await page.screenshot({
        path: example.out.replace(".png", "-joints.png"),
        clip: {
          x: 330 * scale,
          y: (792 - 280) * scale,
          width: 200 * scale,
          height: 240 * scale,
        },
      });
      await page.close();
      console.log("wrote", example.out);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
