import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  transpilePackages: ['@bunker-studio/core', '@bunker-studio/contracts', '@bunker-studio/db'],
};

export default nextConfig;
