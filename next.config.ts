import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-to-printer must stay external: it spawns a bundled SumatraPDF.exe
  // resolved relative to its own node_modules folder.
  // Scan In's page reader (lib/ticket-scan/reader.ts) loads a native canvas
  // and two WebAssembly/worker bundles from their own node_modules folders.
  serverExternalPackages: [
    "nodemailer",
    "pdf-to-printer",
    "pdfjs-dist",
    "@napi-rs/canvas",
    "zxing-wasm",
  ],
  experimental: {
    serverActions: {
      // Construction plans and submittals are often multi-MB PDFs/DWGs.
      bodySizeLimit: "100mb",
    },
    // Request body is buffered by proxy.ts before Server Actions (default 10MB).
    proxyClientMaxBodySize: "100mb",
  },
};

export default nextConfig;
