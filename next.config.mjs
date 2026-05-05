/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/uploads/:path*',
        destination: '/api/uploads/:path*',
      },
    ];
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      
      if (!Array.isArray(config.externals)) {
        config.externals = [config.externals];
      }
      
      config.externals.push(
        '@zilliz/milvus2-sdk-node',
        '@grpc/grpc-js',
        '@grpc/proto-loader',
      );
    }
    
    return config;
  },
};

export default nextConfig;
