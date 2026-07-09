import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const USER_AGENT = "kodeksy-rf-importer/1.0 (+https://pravo.gov.ru)";
const MIN_INTERVAL_MS = 400;
const cacheDir = process.env.PRAVO_CACHE_DIR ?? join("loader", ".cache", "raw");

let lastRequest = 0;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function throttle(): Promise<void> {
  const gap = Date.now() - lastRequest;
  if (gap < MIN_INTERVAL_MS) await delay(MIN_INTERVAL_MS - gap);
  lastRequest = Date.now();
}

function cachePath(url: string): string {
  const key = createHash("sha1").update(url).digest("hex");
  return join(cacheDir, `${key}.txt`);
}

function detectCharset(contentType: string | null, bytes: Uint8Array): string {
  const fromHeader = /charset=([\w-]+)/i.exec(contentType ?? "")?.[1];
  if (fromHeader) return fromHeader.toLowerCase();
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 2048));
  const fromMeta = /charset=["']?([\w-]+)/i.exec(head)?.[1];
  return (fromMeta ?? "utf-8").toLowerCase();
}

class HttpStatusError extends Error {
  constructor(
    readonly status: number,
    url: string,
  ) {
    super(`HTTP ${status} for ${url}`);
  }
}

// Повторять есть смысл только сетевые сбои, 5xx и 429; остальные 4xx
// детерминированы — повторы лишь зря дёргают портал.
function isRetryable(error: unknown): boolean {
  if (error instanceof HttpStatusError) {
    return error.status >= 500 || error.status === 429;
  }
  return true;
}

async function fetchFresh(url: string, attempt = 1): Promise<string> {
  const maxAttempts = 4;
  try {
    await throttle();
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "*/*" },
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) throw new HttpStatusError(response.status, url);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const charset = detectCharset(response.headers.get("content-type"), bytes);
    const decoder = new TextDecoder(charset === "utf8" ? "utf-8" : charset);
    return decoder.decode(bytes);
  } catch (error) {
    if (attempt >= maxAttempts || !isRetryable(error)) throw error;
    await delay(attempt * 1500);
    return fetchFresh(url, attempt + 1);
  }
}

export interface FetchOptions {
  // Списки документов меняются со временем; для них кэш отключается,
  // чтобы каждый прогон видел свежие данные. Тексты редакций кэшируются.
  cache?: boolean;
}

export async function fetchText(url: string, options: FetchOptions = {}): Promise<string> {
  const useCache = options.cache !== false;
  const path = cachePath(url);
  if (useCache && existsSync(path)) return readFileSync(path, "utf-8");
  const text = await fetchFresh(url);
  if (useCache) {
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(path, text, "utf-8");
  }
  return text;
}

export async function fetchJson<T>(url: string, options: FetchOptions = {}): Promise<T> {
  return JSON.parse(await fetchText(url, options)) as T;
}
