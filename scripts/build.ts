import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile } from "fs/promises";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "axios",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "xlsx",
  "zod",
  "zod-validation-error",
];

function parseMode(argv: string[]): string {
  const flag = argv.find((arg) => arg.startsWith("--mode="));
  if (flag) {
    return flag.slice("--mode=".length);
  }
  const idx = argv.indexOf("--mode");
  if (idx !== -1 && argv[idx + 1]) {
    return argv[idx + 1];
  }
  return "production";
}

async function buildAll() {
  const mode = parseMode(process.argv.slice(2));
  const allowedModes = new Set(["production", "staging", "development"]);
  if (!allowedModes.has(mode)) {
    throw new Error(
      `invalid --mode "${mode}". Use one of: ${[...allowedModes].join(", ")}`,
    );
  }

  await rm("dist", { recursive: true, force: true });

  console.log(`building client (mode=${mode})...`);
  await viteBuild({ mode });

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
