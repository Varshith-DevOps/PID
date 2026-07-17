/** @type {import('next').NextConfig} */
const backendUrl = process.env.BACKEND_URL?.replace(/\/$/, '');

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    externalDir: true,
  },
  async rewrites() {
    if (!backendUrl) return [];
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
