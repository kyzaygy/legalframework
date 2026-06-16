import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { importCode } from "./import";
import { discrepancies } from "./parse";
import {
  constitutionSpec,
  fetchCodex,
  fetchCodexSpecs,
  fetchConstitution,
} from "./source";
import type { CodexSpec } from "./types";

if (existsSync(".env")) process.loadEnvFile(".env");

const prisma = new PrismaClient();

async function importOneCodex(spec: CodexSpec, order: number): Promise<void> {
  console.log(`\n[${order + 1}] ${spec.slug} — ${spec.title} (частей: ${spec.parts.length})`);
  const parsed = await fetchCodex(spec);
  const summary = await importCode(prisma, spec, parsed, order);
  console.log(
    `    единиц: ${summary.units}, статей: ${summary.articles} (утратили силу: ${summary.repealed})`,
  );
}

async function importConstitution(order: number): Promise<void> {
  const spec = constitutionSpec();
  console.log(`\n[${order + 1}] ${spec.slug} — ${spec.title}`);
  const parsed = await fetchConstitution();
  const summary = await importCode(prisma, spec, parsed, order);
  console.log(`    единиц: ${summary.units}, статей: ${summary.articles}`);
}

async function runReconnaissance(slugArg: string | undefined): Promise<void> {
  const specs = await fetchCodexSpecs();
  console.log(`Найдено кодексов в перечне: ${specs.length}`);
  const target = slugArg
    ? specs.find((spec) => spec.slug === slugArg)
    : specs.find((spec) => spec.slug === "sk-rf") ?? specs[0];
  if (!target) throw new Error(`Кодекс не найден: ${slugArg ?? "(по умолчанию)"}`);
  await importOneCodex(target, 0);
}

async function runFullImport(): Promise<void> {
  const specs = await fetchCodexSpecs();
  console.log(`Найдено кодексов в перечне: ${specs.length}`);
  let order = 0;
  await importConstitution(order++);
  for (const spec of specs) {
    try {
      await importOneCodex(spec, order++);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      discrepancies.push(`Кодекс ${spec.slug} не импортирован: ${message}`);
      console.error(`    ОШИБКА: ${message}`);
    }
  }
}

async function main(): Promise<void> {
  const [command, arg] = process.argv.slice(2);
  if (command === "all") {
    await runFullImport();
  } else if (command === "codex") {
    await runReconnaissance(arg);
  } else if (command === "constitution") {
    await importConstitution(0);
  } else {
    console.error('Использование: tsx loader/cli.ts <codex [slug] | constitution | all>');
    process.exitCode = 1;
    return;
  }

  if (discrepancies.length > 0) {
    console.log(`\nРасхождения структуры (${discrepancies.length}):`);
    discrepancies.forEach((message) => console.log(`  - ${message}`));
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
