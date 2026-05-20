/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    serverComponentsExternalPackages: [
      "pino",
      "pino-pretty",
      "lighthouse",
      "eslint",
      "eslint-plugin-jsx-a11y",
      "@vue/compiler-sfc",
      "@babel/parser",
      "@babel/traverse",
      "@babel/eslint-parser",
      "@babel/preset-react",
      "cheerio",
      "fast-glob",
      "chrome-launcher",
      "docx",
    ],
  },
  webpack(config, { isServer }) {
    if (isServer) {
      // Treat all scanner dependencies as externals so webpack doesn't try to bundle them
      const existingExternals = config.externals || [];
      config.externals = [
        ...( Array.isArray(existingExternals) ? existingExternals : [existingExternals]),
        "eslint",
        "eslint-plugin-jsx-a11y",
        "@babel/eslint-parser",
        "@babel/preset-react",
        "@vue/compiler-sfc",
        "lighthouse",
        "chrome-launcher",
      ];
    }
    return config;
  },
};

export default nextConfig;
