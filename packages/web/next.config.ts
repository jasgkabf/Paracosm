import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@paracosm/shared'],
  output: 'standalone',
  reactStrictMode: true,
};

export default nextConfig;
