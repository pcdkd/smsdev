/** @type {import('next').NextConfig} */
const nextConfig = {
      transpilePackages: ['@relay-works/sms-dev-types'],
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
  }
}

module.exports = nextConfig 