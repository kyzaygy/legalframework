import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { CONTENT_CACHE_TAG } from "@/lib/queries";

export const dynamic = "force-dynamic";

function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Сброс суточного кэша контента сразу после импорта:
//   curl -X POST -H "x-revalidate-secret: $REVALIDATE_SECRET" https://site/api/revalidate
// Без REVALIDATE_SECRET в окружении эндпоинт отключён.
export async function POST(request: NextRequest) {
  const expected = process.env.REVALIDATE_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "revalidation disabled" }, { status: 404 });
  }
  const provided = request.headers.get("x-revalidate-secret") ?? "";
  if (!secretsMatch(provided, expected)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  revalidateTag(CONTENT_CACHE_TAG);
  return NextResponse.json({ revalidated: true });
}
