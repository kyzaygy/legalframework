import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CodeTree } from "@/components/CodeTree";
import { formatDate } from "@/lib/format";
import { getCodeBySlug, getCodeTree, getCodes } from "@/lib/queries";

export const revalidate = 3600;

export async function generateStaticParams() {
  const codes = await getCodes();
  return codes.map((code) => ({ codeSlug: code.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ codeSlug: string }>;
}): Promise<Metadata> {
  const { codeSlug } = await params;
  const code = await getCodeBySlug(codeSlug);
  if (!code) return {};
  return {
    title: code.title,
    description: `${code.title} — оглавление и полный текст в действующей редакции.`,
    alternates: { canonical: `/${code.slug}` },
  };
}

export default async function CodePage({ params }: { params: Promise<{ codeSlug: string }> }) {
  const { codeSlug } = await params;
  const code = await getCodeBySlug(codeSlug);
  if (!code) notFound();

  const tree = await getCodeTree(code.id);
  const edition = formatDate(code.editionDate);

  return (
    <div className="shell">
      <div className="toc-head">
        <p className="eyebrow">Оглавление</p>
        <h1>{code.title}</h1>
        <div className="meta">
          {edition ? `Действующая редакция · обновлено ${edition}` : "Консолидированный текст"}
        </div>
      </div>
      <CodeTree codeSlug={code.slug} tree={tree} />
    </div>
  );
}
