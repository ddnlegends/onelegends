import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  redirects() {
    return [
      { source: "/reg", destination: "/moderator", permanent: true },
      {
        source: "/reg/:competitionId",
        destination: "/moderator/:competitionId",
        permanent: true,
      },
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
