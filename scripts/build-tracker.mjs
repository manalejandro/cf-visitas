#!/usr/bin/env node
/**
 * Builds the obfuscated tracker served by `GET /tracker.js`.
 *
 * Reads `tracker/tracker.source.js`, obfuscates it (no comments, encoded
 * strings, flattened control flow, renamed identifiers) and writes
 * `tracker/tracker.dist.js`. The Worker imports that file as a raw string and
 * prepends the per-request config before serving it.
 *
 * Usage: npm run build:tracker  (also runs before `dev` and `build`)
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import JavaScriptObfuscator from "javascript-obfuscator";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = join(root, "tracker", "tracker.source.js");
const outputPath = join(root, "tracker", "tracker.dist.js");

const source = readFileSync(sourcePath, "utf8");

const result = JavaScriptObfuscator.obfuscate(source, {
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
  stringArrayWrappersCount: 3,
  stringArrayWrappersType: "variable",
  stringArrayWrappersChainedCalls: true,
  splitStrings: true,
  splitStringsChunkLength: 8,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.35,
  numbersToExpressions: true,
  transformObjectKeys: true,
  unicodeEscapeSequence: false,
  selfDefending: false,
  debugProtection: false,
  disableConsoleOutput: true,
});

const output = result.getObfuscatedCode();

// The served tracker must not leak source comments or identifiers.
for (const marker of ["──", "never served", "Flow:", "MIT License", "fingerprintInput", "renderBlockScreen"]) {
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

runInNewContext(output, { window: windowMock }, { timeout: 2_000 });

if (!accessed.has("__vx")) {
  throw new Error(
    "Obfuscated tracker does not read the injected config (window.__vx) — check tracker.source.js and lib/tracker.ts",
  );
}

writeFileSync(outputPath, `${output}\n`);
console.log(
  `[tracker] obfuscated ${source.length} bytes -> ${output.length} bytes (${(output.length / 1024).toFixed(1)} KiB)`,
);
