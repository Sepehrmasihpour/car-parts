module.exports = {
  globDirectory: "public/",
  globPatterns: ["**/*.{html,js,css,png,svg,json,wasm}"],
  swDest: "public/service-worker.js",
  runtimeCaching: [
    {
      urlPattern: /\.(?:html|js|css|wasm)$/,
      handler: "StaleWhileRevalidate",
    },
  ],
};
