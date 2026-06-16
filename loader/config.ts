function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

export const config = {
  codexUrl: required("PRAVO_CODEX_URL", "http://pravo.gov.ru/codex/"),
  constitutionUrl: required("PRAVO_CONSTITUTION_URL", "http://pravo.gov.ru/constitution/"),
  apiBase: required("PRAVO_API_BASE", "http://actual.pravo.gov.ru:8000/api/ebpi/"),
  bpa: required("PRAVO_BPA", "ebpi"),
};
