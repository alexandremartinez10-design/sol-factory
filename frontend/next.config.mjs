import { createRequire } from "module";
const require = createRequire(import.meta.url);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow images from Irys gateway and ui-avatars
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "gateway.irys.xyz" },
      { protocol: "https", hostname: "ui-avatars.com" },
      { protocol: "https", hostname: "arweave.net" },
    ],
  },

  // Webpack: polyfill Node built-ins for browser (needed by @coral-xyz/anchor + wallet adapters)
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        os: false,
        path: false,
        crypto: false,
        // Provide the `buffer` npm package as the Buffer polyfill
        buffer: require.resolve("buffer/"),
      };
      // Make Buffer available as a global (required by @coral-xyz/anchor in browser)
      config.plugins.push(
        new webpack.ProvidePlugin({ Buffer: ["buffer", "Buffer"] })
      );
    }
    // Silence optional pino-pretty peer dep warning from WalletConnect
    config.resolve.alias = {
      ...config.resolve.alias,
      "pino-pretty": false,
    };
    return config;
  },
};

export default nextConfig;
