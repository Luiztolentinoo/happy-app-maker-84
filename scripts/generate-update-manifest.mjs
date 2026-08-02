#!/usr/bin/env node
/**
 * Gera o manifesto do updater do Tauri a partir dos artefatos assinados.
 *
 *   node scripts/generate-update-manifest.mjs --dir <bundle-dir> --out latest.json \
 *     [--notes CHANGELOG.md] [--channel alpha]
 *
 * Regras:
 * - Cada plataforma precisa de URL HTTPS e assinatura (.sig) presente.
 * - Sem assinatura o script falha: nenhuma release não assinada entra no manifesto.
 * - Nada de secrets é lido ou impresso aqui.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const arg = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const dir = arg("dir", "apps/desktop/src-tauri/target/release/bundle/nsis");
const out = arg("out", "latest.json");
const notesFile = arg("notes", "CHANGELOG.md");
const channel = arg("channel", "alpha");
const baseUrl = arg("base-url", process.env.CLIPCORE_UPDATE_BASE_URL ?? "");

const version = JSON.parse(readFileSync("apps/desktop/src-tauri/tauri.conf.json", "utf8")).version;

if (!baseUrl.startsWith("https://")) {
  console.error("--base-url precisa ser HTTPS (ou defina CLIPCORE_UPDATE_BASE_URL).");
  process.exit(1);
}

const files = readdirSync(dir);
const bundle = files.find((f) => f.endsWith("-setup.exe") || f.endsWith(".exe"));
const sig = files.find((f) => f.endsWith(".sig"));

if (!bundle) {
  console.error(`Nenhum instalador encontrado em ${dir}.`);
  process.exit(1);
}
if (!sig) {
  console.error("Assinatura (.sig) ausente: manifesto não será gerado sem release assinada.");
  process.exit(1);
}

export const manifest = {
  version,
  channel,
  notes: readFileSync(notesFile, "utf8").split("\n").slice(0, 40).join("\n"),
  pub_date: new Date().toISOString(),
  platforms: {
    "windows-x86_64": {
      signature: readFileSync(join(dir, sig), "utf8").trim(),
      url: `${baseUrl.replace(/\/$/, "")}/${encodeURIComponent(bundle)}`,
    },
  },
};

writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Manifesto gravado em ${out} para a versão ${version} (canal ${channel}).`);
