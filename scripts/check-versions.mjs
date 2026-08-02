#!/usr/bin/env node
/**
 * Verifica se a versão do ClipCore está sincronizada em todos os manifestos.
 * A fonte da verdade é APP_VERSION em src/lib/distribution.ts.
 *
 *   bun run scripts/check-versions.mjs
 *
 * Sai com código 1 quando há divergência — usado no CI antes de qualquer release.
 */
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const source = read("src/lib/distribution.ts");
const expected = source.match(/APP_VERSION\s*=\s*"([^"]+)"/)?.[1];
if (!expected) {
  console.error("APP_VERSION não encontrado em src/lib/distribution.ts");
  process.exit(1);
}

const found = [
  ["src/lib/distribution.ts", expected],
  ["apps/desktop/package.json", JSON.parse(read("apps/desktop/package.json")).version],
  [
    "apps/desktop/src-tauri/tauri.conf.json",
    JSON.parse(read("apps/desktop/src-tauri/tauri.conf.json")).version,
  ],
  [
    "apps/desktop/src-tauri/Cargo.toml",
    read("apps/desktop/src-tauri/Cargo.toml").match(/^version\s*=\s*"([^"]+)"/m)?.[1],
  ],
  ["CHANGELOG.md", read("CHANGELOG.md").match(/##\s*\[?(\d+\.\d+\.\d+)/)?.[1]],
];

const bad = found.filter(([, v]) => v !== expected);
for (const [file, v] of found) {
  console.log(`${v === expected ? "ok  " : "FAIL"} ${file}: ${v ?? "(ausente)"}`);
}

if (bad.length) {
  console.error(`\nVersões divergentes (esperado ${expected}). Release bloqueado.`);
  process.exit(1);
}
console.log(`\nTodas as versões sincronizadas em ${expected}.`);
