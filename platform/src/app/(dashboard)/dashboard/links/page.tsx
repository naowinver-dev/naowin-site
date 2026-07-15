import { requireCompanyUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCaptureLink } from "../actions";

async function createLinkAction(formData: FormData) {
  "use server";
  await createCaptureLink(String(formData.get("clientName") ?? "").trim() || null);
}

export default async function LinksPage() {
  const companyUser = await requireCompanyUser();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  const sessions = await prisma.captureSession.findMany({
    where: { companyId: companyUser.companyId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div>
      <h1>Liens de collecte</h1>
      <p>
        Générez un lien (ou QR code, à imprimer depuis le lien) à remettre au client juste après
        la prestation. Le lien expire après 7 jours s&apos;il n&apos;est pas utilisé.
      </p>
      <form action={createLinkAction}>
        <label>
          Nom du client (optionnel)
          <input name="clientName" style={{ display: "block" }} />
        </label>
        <button type="submit" style={{ marginTop: 8 }}>
          Générer un lien
        </button>
      </form>

      <table style={{ width: "100%", marginTop: 24, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #e5ddce" }}>
            <th>Client</th>
            <th>Statut</th>
            <th>Lien</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.id} style={{ borderBottom: "1px solid #f0eae0" }}>
              <td>{s.clientName ?? "—"}</td>
              <td>{s.status}</td>
              <td>
                <code>{`${appUrl}/t/${s.token}`}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
