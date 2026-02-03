export default {
  sourceDir: ".",
  artifactsDir: "web-ext-artifacts",
  ignoreFiles: [
    "src",
    "tests",
    "node_modules",
    "web-ext-artifacts",
    "context",
    "tsconfig.json",
    "esbuild.config.mjs",
    "package.json",
    "package-lock.json",
    ".git",
    ".gitignore",
  ],
  run: {
    startUrl: ["https://www.yad2.co.il/vehicles/cars"],
  },
};
