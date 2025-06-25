
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      { // Added for Firebase Storage
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
      { // Added for Firebase Storage Emulator
        protocol: 'http',
        hostname: 'localhost',
        port: '9199',
        pathname: '/**',
      },
      { // Also allow 127.0.0.1 for Storage Emulator
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '9199',
        pathname: '/**',
      },
      { // Added for i.imgflip.com
        protocol: 'https',
        hostname: 'i.imgflip.com',
        port: '',
        pathname: '/**',
      }
    ],
  },
  experimental: {
    
  },
};

export default nextConfig;
