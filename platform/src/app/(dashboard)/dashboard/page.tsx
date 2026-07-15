import { requireCompanyUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publishTestimonial, archiveTestimonial, requestDownload } from "./actions";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "En cours",
  PROCESSING: "Traitement",
  COLLECTED: "Collecté",
  PUBLISHED: "Publié",
  ARCHIVED: "Archivé",
};

async function requestDownloadAction(testimonialId: string) {
  "use server";
  // Le résultat (URLs de téléchargement) serait affiché via un composant
  // client avec useTransition en production ; ici l'action déclenche
  // simplement la facturation et le déblocage côté back-office.
  await requestDownload(testimonialId);
}

export default async function TestimonialLibraryPage() {
  const companyUser = await requireCompanyUser();

  const testimonials = await prisma.testimonial.findMany({
    where: { companyId: companyUser.companyId, status: { not: "DRAFT" } },
    orderBy: { createdAt: "desc" },
    include: { captureSession: true },
  });

  return (
    <div>
      <h1>Bibliothèque de témoignages</h1>
      <p>
        La consultation est gratuite. Le téléchargement (fichier HD + synthèse) déclenche la
        facturation à l&apos;unité.
      </p>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #e5ddce" }}>
            <th>Client</th>
            <th>Statut</th>
            <th>Synthèse</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {testimonials.map((t) => (
            <tr key={t.id} style={{ borderBottom: "1px solid #f0eae0" }}>
              <td>{t.captureSession.clientName ?? "Client anonyme"}</td>
              <td>{STATUS_LABELS[t.status]}</td>
              <td style={{ maxWidth: 360 }}>{t.synthesisText?.slice(0, 140)}…</td>
              <td style={{ display: "flex", gap: 8 }}>
                {t.status !== "PUBLISHED" && (
                  <form action={publishTestimonial.bind(null, t.id)}>
                    <button type="submit">Publier</button>
                  </form>
                )}
                {t.status !== "ARCHIVED" && (
                  <form action={archiveTestimonial.bind(null, t.id, "Qualité technique insuffisante")}>
                    <button type="submit">Archiver</button>
                  </form>
                )}
                <form action={requestDownloadAction.bind(null, t.id)}>
                  <button type="submit">Télécharger (facturé)</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
