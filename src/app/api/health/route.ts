import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Лёгкая проверка живости для внешнего мониторинга (UptimeRobot и т.п.):
// приложение отвечает и БД доступна. Никаких деталей наружу не отдаёт.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
