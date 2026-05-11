/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@paracosm/shared'],
  output: 'standalone',
  reactStrictMode: true,
};

export default nextConfig;
