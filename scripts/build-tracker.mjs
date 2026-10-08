#!/usr/bin/env node
/**
 * Builds the obfuscated tracker served by `GET /tracker.js`.
 *
 * Steps:
 *   1. Bundle `tracker/tracker.source.js` with its dependency
 *      (@noble/post-quantum for ML-KEM-1024) into a single IIFE using Vite.
 *   2. Obfuscate the bundle (no comments, encoded strings, renamed identifiers,
 *      flattened control flow).
 *   3. Sanity checks + a runtime smoke test that proves the bundle reads the
 *      injected config (`window.__vx`).
 *
 * The Worker imports the generated `tracker/tracker.dist.js` as a raw string
 * and prepends the per-request config before serving it.
 *
 * Usage: npm run build:tracker  (also runs before `dev` and `build`)
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { build } from "vite";
import JavaScriptObfuscator from "javascript-obfuscator";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = join(root, "tracker", "tracker.source.js");
const outputPath = join(root, "tracker", "tracker.dist.js");

// ── 1. Bundle (tracker + @noble/post-quantum) ───────────────────────────────

const buildResult = await build({
  root,
  configFile: false,
  logLevel: "silent",
  build: {
    write: false,
    minify: true,
    target: "es2018",
    lib: {
      entry: sourcePath,
      name: "VisitasTracker",
      formats: ["iife"],
      fileName: () => "tracker.js",
    },
  },
});

const outputs = Array.isArray(buildResult) ? buildResult[0].output : buildResult.output;
const chunk = outputs.find((entry) => entry.type === "chunk");
if (!chunk) throw new Error("Tracker bundle produced no chunk");

const bundle = chunk.code;
const source = readFileSync(sourcePath, "utf8");

// ── 2. Obfuscate ────────────────────────────────────────────────────────────

const result = JavaScriptObfuscator.obfuscate(bundle, {
  target: "browser",
  seed: 20261008,
  compact: true,
  simplify: true,
  identifierNamesGenerator: "hexadecimal",
  renameGlobals: false,
  renameProperties: false,
  stringArray: true,
  stringArrayThreshold: 1,
  stringArrayEncoding: ["base64"],
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 1,
  stringArrayWrappersType: "variable",
  stringArrayWrappersChainedCalls: false,
  splitStrings: false,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.5,
  deadCodeInjection: false,
  numbersToExpressions: false,
  transformObjectKeys: true,
  unicodeEscapeSequence: false,
  selfDefending: false,
  debugProtection: false,
  disableConsoleOutput: true,
});

const output = result.getObfuscatedCode();

// ── 3. Checks ───────────────────────────────────────────────────────────────

for (const marker of ["──", "never served", "Flow:", "MIT License", "fingerprintInput", "buildBlockScreen"]) {
  if (output.includes(marker)) {
    throw new Error(`Obfuscated tracker still contains "${marker}" — aborting`);
  }
}

// Runtime smoke test: the bundle must execute and read the injected config
// property (`window.__vx`) before doing anything else. A recording Proxy makes
// this observable without a browser.
const accessed = new Set();
const windowMock = new Proxy(
  {},
  {
    get(target, property) {
      accessed.add(String(property));
      return Reflect.get(target, property);
    },
    set(target, property, value) {
      accessed.add(String(property));
      return Reflect.set(target, property, value);
    },
    has(target, property) {
      accessed.add(String(property));
      return Reflect.has(target, property);
    },
  },
);

runInNewContext(output, { window: windowMock }, { timeout: 5_000 });

if (!accessed.has("__vx")) {
  throw new Error(
    "Obfuscated tracker does not read the injected config (window.__vx) — check tracker.source.js and lib/tracker.ts",
  );
}

writeFileSync(outputPath, `${output}\n`);
console.log(
  `[tracker] bundle ${bundle.length} bytes -> obfuscated ${output.length} bytes (${(output.length / 1024).toFixed(1)} KiB)`,
);
