/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['@aws-sdk/client-bedrock-runtime'],
}

module.exports = nextConfig
