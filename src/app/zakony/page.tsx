import type { Metadata } from "next";
import { ZakonyCatalog } from "@/components/ZakonyCatalog";
import { getLaws } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Федеральные законы",
  description:
    "Все действующие федеральные законы Российской Федерации в актуальной редакции. Поиск по названию и номеру.",
  alternates: { canonical: "/zakony" },
};

export default async function ZakonyPage() {
  const laws = await getLaws();

  return (
    <div className="shell">
      <div className="toc-head">
        <p className="eyebrow">Федеральные законы</p>
        <h1>Федеральные законы РФ</h1>
        <div className="meta">Действующие федеральные законы в актуальной редакции.</div>
      </div>
      <ZakonyCatalog laws={laws} />
    </div>
  );
}
