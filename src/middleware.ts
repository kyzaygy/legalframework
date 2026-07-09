import { NextResponse, type NextRequest } from "next/server";

// ——— CSP с per-request nonce ———
// Политика собирается здесь (а не в Caddy), потому что nonce должен меняться на
// каждый запрос и подставляться Next'ом в его инлайновые скрипты: Next читает
// nonce из заголовка Content-Security-Policy ВХОДЯЩЕГО запроса.
// Пока режим Report-Only: нарушения видны в консоли браузера, ничего не
// блокируется. После периода наблюдения переключить CSP_ENFORCE в true.
const CSP_ENFORCE = false;

function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    // strict-dynamic: доверие распространяется на скрипты, загруженные
    // nonce-скриптами Next; 'self' — запасной вариант для старых браузеров.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    // unsafe-inline для стилей: инлайновые style-атрибуты React.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

// ——— Rate limit для /search ———
// Полнотекстовый поиск — самые дорогие запросы к БД; ограничение защищает от
// скрейперов и случайных петель. Однопроцессный деплой — in-memory достаточно.
const SEARCH_WINDOW_MS = 60_000;
const SEARCH_MAX_PER_WINDOW = 30;
const searchHits = new Map<string, number[]>();

function clientIp(request: NextRequest): string {
  // Caddy проставляет X-Forwarded-For; первый адрес — клиент.
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return "unknown";
}

function isSearchRateLimited(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - SEARCH_WINDOW_MS;
  const hits = (searchHits.get(ip) ?? []).filter((ts) => ts > cutoff);
  hits.push(now);
  searchHits.set(ip, hits);
  // Не даём карте расти бесконечно: изредка чистим устаревшие записи.
  if (searchHits.size > 10_000) {
    for (const [key, timestamps] of searchHits) {
      if (timestamps.every((ts) => ts <= cutoff)) searchHits.delete(key);
    }
  }
  return hits.length > SEARCH_MAX_PER_WINDOW;
}

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/search" && isSearchRateLimited(clientIp(request))) {
    return new NextResponse("Слишком много запросов. Попробуйте через минуту.", {
      status: 429,
      headers: {
        "Retry-After": "60",
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);

  // В заголовки ЗАПРОСА кладём полноценный CSP — по нему Next подставляет
  // nonce в свои инлайновые скрипты при рендере.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(
    CSP_ENFORCE ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only",
    csp,
  );
  return response;
}

export const config = {
  matcher: [
    // Всё, кроме статики: ей CSP-заголовок не нужен, а rate-limit тем более.
    "/((?!_next/static|_next/image|fonts/|favicon.ico|app-icon-|robots.txt|sitemap).*)",
  ],
};
