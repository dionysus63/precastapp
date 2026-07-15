import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-to-printer must stay external: it spawns a bundled SumatraPDF.exe
  // resolved relative to its own node_modules folder.
  serverExternalPackages: ["nodemailer", "pdf-to-printer"],
  experimental: {
    serverActions: {
      // Construction plans and submittals are often multi-MB PDFs/DWGs.
      bodySizeLimit: "100mb",
    },
    // Request body is buffered by middleware/proxy before Server Actions (default 10MB).
    proxyClientMaxBodySize: "100mb",
  },
};

export default nextConfig;
