import * as esbuild from "esbuild";
import { copyFile, mkdir } from "fs/promises";
import { existsSync } from "fs";

const isWatch = process.argv.includes("--watch");

const entryPoints = [
  { in: "src/background/index.ts", out: "background" },
  { in: "src/content/index.ts", out: "content" },
  { in: "src/content/page-script.ts", out: "page-script" },
  { in: "src/popup/popup.ts", out: "popup" },
  { in: "src/options/options.ts", out: "options" },
];

const staticFiles = [
  { from: "src/popup/popup.html", to: "dist/popup.html" },
  { from: "src/popup/popup.css", to: "dist/popup.css" },
  { from: "src/options/options.html", to: "dist/options.html" },
  { from: "src/options/options.css", to: "dist/options.css" },
];

async function copyStaticFiles() {
  if (!existsSync("dist")) {
    await mkdir("dist", { recursive: true });
  }
  for (const { from, to } of staticFiles) {
    if (existsSync(from)) {
      await copyFile(from, to);
    }
  }
}

/** @type {import('esbuild').BuildOptions} */
const buildOptions = {
  entryPoints: entryPoints.map((ep) => ({ in: ep.in, out: ep.out })),
  bundle: true,
  outdir: "dist",
  format: "esm",
  target: "es2022",
  sourcemap: true,
  logLevel: "info",
  plugins: [
    {
      name: "copy-static",
      setup(build) {
        build.onEnd(async () => {
          await copyStaticFiles();
        });
      },
    },
  ],
};

if (isWatch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log("Watching for changes...");
} else {
  await esbuild.build(buildOptions);
  console.log("Build complete.");
}
