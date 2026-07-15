import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

/**
 * Résout l'utilisateur back-office courant (entreprise + rôle) à partir de
 * la session Clerk. Redirige vers /onboarding si ce compte Clerk n'est
 * encore rattaché à aucune entreprise.
 */
export async function requireCompanyUser() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const companyUser = await prisma.companyUser.findUnique({
    where: { clerkUserId: userId },
    include: { company: true },
  });

  if (!companyUser) redirect("/onboarding");

  return companyUser;
}
