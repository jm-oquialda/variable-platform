import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Resume uploads go through a server action; files are capped at 5 MB
    // (RESUME_MAX_BYTES), so allow a little more for the rest of the form.
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
