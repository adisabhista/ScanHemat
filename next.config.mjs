/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb"
    }
  },
  serverExternalPackages: [
    "@google-cloud/documentai",
    "google-gax",
    "@grpc/grpc-js"
  ]
};

export default nextConfig;
