/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  output: 'standalone',
  reactStrictMode: false,
  compress: true,
  productionBrowserSourceMaps: false,
  typescript: {
    // Separate typecheck is performed via `npm run lint` (`tsc --noEmit`).
    // Skipping duplicate in-process type checking during next build saves ~400-800MB RAM.
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    // Dramatically reduces peak memory footprint during Webpack compilation on constrained servers
    webpackMemoryOptimizations: true,
    cpus: 1,
    workerThreads: false,
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ignored: ['**/.git/**', '**/node_modules/**', '**/.next/**'],
        aggregateTimeout: 300,
      };
    } else {
      // Disable expensive source map generation to conserve memory
      config.devtool = false;
    }
    return config;
  },
};

export default nextConfig;
