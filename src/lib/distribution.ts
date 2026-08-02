/**
 * Fonte única de identidade e distribuição do ClipCore.
 *
 * Qualquer nome, versão, canal, caminho de instalador ou sidecar exibido na
 * interface (ou usado por scripts de build) precisa vir daqui. `scripts/check-versions.mjs`
 * compara `APP_VERSION` com package.json, apps/desktop/package.json, Cargo.toml
 * e tauri.conf.json e falha a build se houver divergência.
 */

/** Versão semântica única do produto (MAJOR.MINOR.PATCH). */
export const APP_VERSION = "0.1.0";

/** Identificador estável do aplicativo — não alterar após releases públicas. */
export const APP_IDENTIFIER = "com.clipcore.desktop";

export const APP_PRODUCT_NAME = "ClipCore";
export const APP_PUBLISHER = "ClipCore";
export const APP_COPYRIGHT = `© ${new Date().getUTCFullYear()} ClipCore`;
export const APP_DESCRIPTION =
  "Capture seus melhores momentos de gameplay sem perder FPS, sem bagunça e sem depender da nuvem.";

export const APP_URLS = {
  homepage: "https://clipcore.dev",
  download: "https://clipcore.dev/download",
  support: "https://clipcore.dev/suporte",
  privacy: "https://clipcore.dev/privacidade",
  terms: "https://clipcore.dev/termos",
  /** Manifesto do updater (assinado). Só é consultado quando o canal permite. */
  updates: "https://updates.clipcore.dev/{{target}}/{{arch}}/{{current_version}}",
} as const;

export const RELEASE_CHANNELS = ["development", "alpha", "beta", "stable"] as const;
export type ReleaseChannel = (typeof RELEASE_CHANNELS)[number];

/** Canal atual. Captura real ainda é simulada, então nunca "stable". */
export const APP_CHANNEL: ReleaseChannel = "alpha";

export const CHANNEL_LABEL: Record<ReleaseChannel, string> = {
  development: "Development",
  alpha: "Alpha",
  beta: "Beta",
  stable: "Estável",
};

/** Rótulo mostrado na interface, ex.: "ClipCore Alpha 0.1.0". */
export function appDisplayName(channel: ReleaseChannel = APP_CHANNEL): string {
  return channel === "stable"
    ? `${APP_PRODUCT_NAME} ${APP_VERSION}`
    : `${APP_PRODUCT_NAME} ${CHANNEL_LABEL[channel]} ${APP_VERSION}`;
}

/** Somente canais com artefatos assinados podem receber atualização automática. */
export function channelAllowsAutoUpdate(channel: ReleaseChannel = APP_CHANNEL): boolean {
  return channel === "beta" || channel === "stable";
}

/** Detecta o canal a partir de uma versão/tag (`v0.2.0-beta.1`). */
export function detectChannel(version: string): ReleaseChannel {
  const v = version.trim().toLowerCase();
  if (v.includes("-alpha")) return "alpha";
  if (v.includes("-beta")) return "beta";
  if (v.includes("-dev") || v.includes("+dev")) return "development";
  return /^v?\d+\.\d+\.\d+$/.test(v) ? "stable" : "development";
}

// ---------------------------------------------------------------- instaladores

export type InstallerKind = "nsis" | "msi";
export type TargetArch = "x64" | "arm64";

/** Arquiteturas realmente suportadas hoje. ARM64 fica preparado, não anunciado. */
export const SUPPORTED_ARCHS: TargetArch[] = ["x64"];

export interface InstallerArtifact {
  kind: InstallerKind;
  /** Nome final publicado, ex.: ClipCore-Setup-0.1.0-x64.exe */
  fileName: string;
  arch: TargetArch;
  /** Nome bruto gerado pelo Tauri antes do rename no CI. */
  bundleName: string;
  recommended: boolean;
  audience: string;
}

/** Nomes versionados e explícitos — nunca setup.exe / installer.exe. */
export function installerArtifacts(
  version = APP_VERSION,
  arch: TargetArch = "x64",
): InstallerArtifact[] {
  return [
    {
      kind: "nsis",
      fileName: `ClipCore-Setup-${version}-${arch}.exe`,
      bundleName: `ClipCore_${version}_${arch}-setup.exe`,
      arch,
      recommended: true,
      audience: "Usuário final (instalação por usuário, sem administrador).",
    },
    {
      kind: "msi",
      fileName: `ClipCore-${version}-${arch}.msi`,
      bundleName: `ClipCore_${version}_${arch}_en-US.msi`,
      arch,
      recommended: false,
      audience: "Implantação corporativa por máquina (requer administrador).",
    },
  ];
}

/** Contrato consumido pela futura página oficial de download. */
export interface DownloadOffer {
  product: string;
  version: string;
  channel: ReleaseChannel;
  platform: "windows";
  arch: TargetArch;
  installer: InstallerArtifact;
  /** SHA-256 publicado junto ao artefato (preenchido pelo CI). */
  sha256: string | null;
  sizeBytes: number | null;
  requirements: string[];
  warning: string | null;
  changelogUrl: string;
  privacyUrl: string;
  termsUrl: string;
}

export const WINDOWS_REQUIREMENTS = [
  "Windows 10 64-bit (versão ainda suportada pela Microsoft) ou Windows 11 64-bit",
  "Processador x86_64",
  "GPU com encoder de hardware recomendada (NVENC, AMF ou QuickSync)",
  "WebView2 (instalado automaticamente pelo instalador)",
  "10 GB livres recomendados para o buffer e a biblioteca",
];

export function downloadOffer(
  overrides: Partial<Pick<DownloadOffer, "sha256" | "sizeBytes">> = {},
): DownloadOffer {
  const installer = installerArtifacts().find((a) => a.recommended)!;
  return {
    product: APP_PRODUCT_NAME,
    version: APP_VERSION,
    channel: APP_CHANNEL,
    platform: "windows",
    arch: "x64",
    installer,
    sha256: overrides.sha256 ?? null,
    sizeBytes: overrides.sizeBytes ?? null,
    requirements: WINDOWS_REQUIREMENTS,
    warning:
      APP_CHANNEL === "stable"
        ? null
        : `Build ${CHANNEL_LABEL[APP_CHANNEL]}: a captura nativa ainda está em validação e alguns módulos são simulados.`,
    changelogUrl: `${APP_URLS.homepage}/changelog`,
    privacyUrl: APP_URLS.privacy,
    termsUrl: APP_URLS.terms,
  };
}

// -------------------------------------------------------------------- sidecars

export interface SidecarSpec {
  /** Nome fixo do binário, sem sufixo de target triple. */
  name: string;
  /** Nome do arquivo empacotado pelo Tauri (externalBin + target triple). */
  bundleFile: string;
  required: boolean;
  license: string;
  /** Primeiro argumento permitido — nada fora desta lista é executado. */
  allowedArgs: string[];
  /** Tempo máximo de execução, em milissegundos. */
  timeoutMs: number;
  checksumEnvVar: string;
  urlEnvVar: string;
}

export const SIDECARS: SidecarSpec[] = [
  {
    name: "ffmpeg",
    bundleFile: "ffmpeg-x86_64-pc-windows-msvc.exe",
    required: true,
    license: "LGPL-2.1-or-later (build LGPL; builds GPL não são distribuídas)",
    allowedArgs: ["-version", "-hide_banner", "-y", "-i", "-f", "-ss", "-t", "-vf", "-c", "-map"],
    timeoutMs: 120_000,
    checksumEnvVar: "FFMPEG_SHA256",
    urlEnvVar: "FFMPEG_URL",
  },
  {
    name: "ffprobe",
    bundleFile: "ffprobe-x86_64-pc-windows-msvc.exe",
    required: true,
    license: "LGPL-2.1-or-later",
    allowedArgs: ["-version", "-hide_banner", "-v", "-show_format", "-show_streams", "-i", "-of"],
    timeoutMs: 30_000,
    checksumEnvVar: "FFPROBE_SHA256",
    urlEnvVar: "FFPROBE_URL",
  },
];

/** Um sidecar só executa argumentos declarados: nada vem do frontend. */
export function isAllowedSidecarInvocation(name: string, args: readonly string[]): boolean {
  const spec = SIDECARS.find((s) => s.name === name);
  if (!spec || args.length === 0) return false;
  return args.filter((a) => a.startsWith("-")).every((a) => spec.allowedArgs.includes(a));
}

/** Valida o formato de um SHA-256 (64 hex). Checksum vazio reprova. */
export function isValidSha256(value: string | null | undefined): boolean {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value.trim());
}

// --------------------------------------------------------------------- paths

/**
 * Separação obrigatória entre instalação e dados mutáveis.
 * Nada gravável mora no diretório de instalação.
 */
export const WINDOWS_PATHS = {
  installPerUser: "%LOCALAPPDATA%\\Programs\\ClipCore",
  installPerMachine: "%PROGRAMFILES%\\ClipCore",
  config: "%APPDATA%\\com.clipcore.desktop",
  data: "%APPDATA%\\com.clipcore.desktop",
  cache: "%LOCALAPPDATA%\\com.clipcore.desktop\\cache",
  logs: "%LOCALAPPDATA%\\com.clipcore.desktop\\logs",
  database: "%APPDATA%\\com.clipcore.desktop\\clipcore.db",
  clips: "%USERPROFILE%\\Videos\\ClipCore",
  updateStaging: "%LOCALAPPDATA%\\com.clipcore.desktop\\updates",
} as const;

/** Diretórios criados pelo app — usados para desinstalação segura. */
export const CLIPCORE_OWNED_MARKER = ".clipcore-owned";
