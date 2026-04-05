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
      { protocol: "https", hostname: "gateway.pinata.cloud" },
      { protocol: "https", hostname: "ipfs.io" },
      { protocol: "https", hostname: "cloudflare-ipfs.com" },
    ],
  },

  // Webpack: polyfill Node built-ins for browser (needed by @coral-xyz/anchor + wallet adapters)
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs:      false,
        net:     false,
        tls:     false,
        os:      false,
        path:    false,
        buffer:  require.resolve("buffer/"),
        stream:  require.resolve("stream-browserify"),
        crypto:  require.resolve("crypto-browserify"),
        process: require.resolve("process/browser"),
      };
      config.plugins.push(
        new webpack.ProvidePlugin({
          Buffer:  ["buffer", "Buffer"],
          process: "process/browser",
        })
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
