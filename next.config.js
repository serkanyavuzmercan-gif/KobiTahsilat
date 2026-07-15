/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Ödeme talebi PDF'i pdf-lib ile Türkçe font gömerek üretir; font dosyalarının
  // Vercel serverless paketine dahil edilmesini garanti eder.
  outputFileTracingIncludes: {
    '/api/odeme-talebi/pdf': ['./assets/fonts/**'],
  },
}

module.exports = nextConfig
