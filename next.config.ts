import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
