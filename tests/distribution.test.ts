/**
 * Testes da camada de distribuição Windows: versões, instaladores, sidecars,
 * checksums, caminhos, canais e regras do updater.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  APP_CHANNEL,
  APP_IDENTIFIER,
  APP_VERSION,
  CLIPCORE_OWNED_MARKER,
  SIDECARS,
  SUPPORTED_ARCHS,
  WINDOWS_PATHS,
  appDisplayName,
  channelAllowsAutoUpdate,
  detectChannel,
  downloadOffer,
  installerArtifacts,
  isAllowedSidecarInvocation,
  isValidSha256,
} from "@/lib/distribution";
import { baseUpdateInfo, updateBlockReason } from "@/services/updateService";
import { DESTRUCTIVE_REPAIRS } from "@/services/installationService";

const read = (p: string) => readFileSync(p, "utf8");
const tauriConf = JSON.parse(read("apps/desktop/src-tauri/tauri.conf.json"));

describe("sincronização de versões", () => {
  it("tauri.conf.json usa APP_VERSION", () => {
    expect(tauriConf.version).toBe(APP_VERSION);
  });

  it("Cargo.toml usa APP_VERSION", () => {
    const version = read("apps/desktop/src-tauri/Cargo.toml").match(/^version = "(.+)"$/m)?.[1];
    expect(version).toBe(APP_VERSION);
  });

  it("apps/desktop/package.json usa APP_VERSION", () => {
    expect(JSON.parse(read("apps/desktop/package.json")).version).toBe(APP_VERSION);
  });

  it("CHANGELOG documenta a versão atual", () => {
    expect(read("CHANGELOG.md")).toContain(`## [${APP_VERSION}]`);
  });
});

describe("identidade do aplicativo", () => {
  it("identificador é estável e único", () => {
    expect(APP_IDENTIFIER).toBe("com.clipcore.desktop");
    expect(tauriConf.identifier).toBe(APP_IDENTIFIER);
  });

  it("publisher, homepage e copyright estão preenchidos", () => {
    expect(tauriConf.bundle.publisher).toBeTruthy();
    expect(tauriConf.bundle.homepage).toContain("https://");
    expect(tauriConf.bundle.copyright).toBeTruthy();
  });

  it("rótulo da interface identifica canal não estável", () => {
    expect(appDisplayName("alpha")).toBe(`ClipCore Alpha ${APP_VERSION}`);
    expect(appDisplayName("stable")).toBe(`ClipCore ${APP_VERSION}`);
  });
});

describe("instaladores", () => {
  it("gera NSIS e MSI versionados, sem nomes genéricos", () => {
    const names = installerArtifacts().map((a) => a.fileName);
    expect(names).toEqual([
      `ClipCore-Setup-${APP_VERSION}-x64.exe`,
      `ClipCore-${APP_VERSION}-x64.msi`,
    ]);
    for (const n of names) {
      expect(n).not.toMatch(/^(setup|app|installer)\.exe$/i);
      expect(n).toContain(APP_VERSION);
    }
  });

  it("NSIS é o recomendado ao usuário final", () => {
    expect(installerArtifacts().find((a) => a.recommended)?.kind).toBe("nsis");
  });

  it("tauri.conf.json declara os dois formatos", () => {
    expect(tauriConf.bundle.targets).toContain("nsis");
    expect(tauriConf.bundle.targets).toContain("msi");
  });

  it("NSIS instala por usuário, sem administrador", () => {
    expect(tauriConf.bundle.windows.nsis.installMode).toBe("currentUser");
  });

  it("downgrade é bloqueado", () => {
    expect(tauriConf.bundle.windows.allowDowngrades).toBe(false);
  });

  it("apenas x64 é anunciado como suportado", () => {
    expect(SUPPORTED_ARCHS).toEqual(["x64"]);
  });
});

describe("sidecars", () => {
  it("ffmpeg e ffprobe são empacotados pelo bundle", () => {
    expect(tauriConf.bundle.externalBin).toEqual(["binaries/ffmpeg", "binaries/ffprobe"]);
  });

  it("cada sidecar tem nome fixo, licença, timeout e checksum", () => {
    for (const s of SIDECARS) {
      expect(s.bundleFile).toContain("x86_64-pc-windows-msvc");
      expect(s.license).toMatch(/LGPL/);
      expect(s.timeoutMs).toBeGreaterThan(0);
      expect(s.checksumEnvVar).toMatch(/_SHA256$/);
      expect(s.allowedArgs.length).toBeGreaterThan(0);
    }
  });

  it("aceita apenas argumentos declarados", () => {
    expect(isAllowedSidecarInvocation("ffmpeg", ["-version"])).toBe(true);
    expect(isAllowedSidecarInvocation("ffmpeg", ["-i", "in.mp4", "-c", "copy", "out.mp4"])).toBe(
      true,
    );
    expect(isAllowedSidecarInvocation("ffmpeg", ["--exec", "calc.exe"])).toBe(false);
    expect(isAllowedSidecarInvocation("ffprobe", ["-show_format", "-i", "a.mp4"])).toBe(true);
    expect(isAllowedSidecarInvocation("desconhecido", ["-version"])).toBe(false);
    expect(isAllowedSidecarInvocation("ffmpeg", [])).toBe(false);
  });
});

describe("checksums", () => {
  it("aceita apenas SHA-256 de 64 hex", () => {
    expect(isValidSha256("a".repeat(64))).toBe(true);
    expect(isValidSha256("A1B2".padEnd(64, "0"))).toBe(true);
    expect(isValidSha256("")).toBe(false);
    expect(isValidSha256(null)).toBe(false);
    expect(isValidSha256("z".repeat(64))).toBe(false);
    expect(isValidSha256("a".repeat(63))).toBe(false);
  });

  it("script de sidecars recusa download sem checksum", () => {
    const script = read("scripts/fetch-ffmpeg.ps1");
    expect(script).toContain("Checksum vazio nao e aceito");
    expect(script).toContain("checksum divergente");
    expect(script).toContain("precisa usar HTTPS");
  });
});

describe("caminhos", () => {
  it("dados mutáveis ficam fora do diretório de instalação", () => {
    for (const key of [
      "config",
      "data",
      "cache",
      "logs",
      "database",
      "clips",
      "updateStaging",
    ] as const) {
      expect(WINDOWS_PATHS[key]).not.toContain("Programs\\ClipCore");
      expect(WINDOWS_PATHS[key]).not.toContain("PROGRAMFILES");
    }
  });

  it("clipes ficam em Vídeos, nunca na instalação", () => {
    expect(WINDOWS_PATHS.clips).toContain("Videos\\ClipCore");
  });

  it("há marcador de diretório próprio para desinstalação segura", () => {
    expect(CLIPCORE_OWNED_MARKER).toBe(".clipcore-owned");
  });
});

describe("canais e updater", () => {
  it("detecta canal a partir da versão", () => {
    expect(detectChannel("0.2.0")).toBe("stable");
    expect(detectChannel("v1.0.0")).toBe("stable");
    expect(detectChannel("0.2.0-beta.1")).toBe("beta");
    expect(detectChannel("0.1.0-alpha.3")).toBe("alpha");
    expect(detectChannel("0.1.0-dev")).toBe("development");
  });

  it("auto-update só em beta e stable", () => {
    expect(channelAllowsAutoUpdate("alpha")).toBe(false);
    expect(channelAllowsAutoUpdate("development")).toBe(false);
    expect(channelAllowsAutoUpdate("beta")).toBe(true);
    expect(channelAllowsAutoUpdate("stable")).toBe(true);
  });

  it("updater permanece inativo enquanto a chave é placeholder", () => {
    expect(tauriConf.plugins.updater.active).toBe(false);
    expect(tauriConf.plugins.updater.pubkey).toContain("REPLACE_WITH");
    expect(tauriConf.plugins.updater.endpoints[0]).toMatch(/^https:\/\//);
  });

  it("no canal atual o updater é bloqueado e explica o motivo", () => {
    expect(APP_CHANNEL).not.toBe("stable");
    expect(updateBlockReason()).toBeTruthy();
  });

  it("no navegador o estado é indisponível", () => {
    expect(baseUpdateInfo().status).toBe("unavailable_in_browser");
  });
});

describe("manifesto do updater", () => {
  it("exige assinatura e HTTPS", () => {
    const script = read("scripts/generate-update-manifest.mjs");
    expect(script).toContain("Assinatura (.sig) ausente");
    expect(script).toContain("precisa ser HTTPS");
  });
});

describe("segredos e artefatos", () => {
  it("nenhuma chave privada ou certificado está versionado", () => {
    const conf = read("apps/desktop/src-tauri/tauri.conf.json");
    expect(conf).not.toContain("BEGIN PRIVATE KEY");
    expect(conf).not.toContain("TAURI_SIGNING_PRIVATE_KEY=");
  });

  it("workflow de release não é disparado por commit qualquer", () => {
    const wf = read(".github/workflows/release.yml");
    expect(wf).toContain("workflow_dispatch");
    expect(wf).toContain("tags:");
    expect(wf).not.toMatch(/on:\s*\n\s*push:\s*\n\s*branches/);
  });
});

describe("oferta de download", () => {
  it("expõe tudo que a página oficial precisa", () => {
    const offer = downloadOffer({ sha256: "b".repeat(64), sizeBytes: 91_000_000 });
    expect(offer.installer.fileName).toContain(APP_VERSION);
    expect(offer.requirements.length).toBeGreaterThan(3);
    expect(offer.warning).toContain("Alpha");
    expect(isValidSha256(offer.sha256)).toBe(true);
    expect(offer.privacyUrl).toMatch(/^https:\/\//);
  });
});

describe("reparo", () => {
  it("ações destrutivas estão marcadas para exigir confirmação", () => {
    expect(DESTRUCTIVE_REPAIRS).toContain("clear_cache");
    expect(DESTRUCTIVE_REPAIRS).toContain("rebuild_index");
  });
});
