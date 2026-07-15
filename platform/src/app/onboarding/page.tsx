import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createCompany } from "./actions";

export default async function OnboardingPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const existing = await prisma.companyUser.findUnique({ where: { clerkUserId: userId } });
  if (existing) redirect("/dashboard");

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "48px 24px" }}>
      <h1>Créer votre entreprise</h1>
      <p>
        Un jeu de 4 questions par défaut (problème / expérience / résultat / recommandation)
        sera créé automatiquement — vous pourrez les personnaliser ensuite.
      </p>
      <form action={createCompany}>
        <label>
          Nom de l&apos;entreprise
          <input name="name" required style={{ display: "block", width: "100%", marginTop: 4 }} />
        </label>
        <button type="submit" style={{ marginTop: 16 }}>
          Créer
        </button>
      </form>
    </main>
  );
}
