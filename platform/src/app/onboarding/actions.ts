"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { stripe, createSetupFeeCheckoutSession } from "@/lib/stripe";

const DEFAULT_QUESTIONS: Array<{
  phase: "PROBLEM" | "EXPERIENCE" | "RESULT" | "RECOMMENDATION";
  promptText: string;
}> = [
  { phase: "PROBLEM", promptText: "Quel problème cherchiez-vous à résoudre ?" },
  { phase: "EXPERIENCE", promptText: "Qu'est-ce qui vous a marqué pendant la prestation ?" },
  { phase: "RESULT", promptText: "Qu'est-ce qui a changé pour vous après ?" },
  { phase: "RECOMMENDATION", promptText: "Vous diriez quoi à quelqu'un qui hésite ?" },
];

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "entreprise"
  );
}

export async function createCompany(formData: FormData) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Le nom de l'entreprise est requis");

  const baseSlug = slugify(name);
  let slug = baseSlug;
  let attempt = 0;
  while (await prisma.company.findUnique({ where: { slug } })) {
    attempt += 1;
    slug = `${baseSlug}-${attempt}`;
  }

  const user = await (await clerkClient()).users.getUser(userId);
  const email = user.emailAddresses[0]?.emailAddress ?? `${userId}@placeholder.local`;

  const company = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({ data: { name, slug } });

    await tx.companyUser.create({
      data: { companyId: company.id, clerkUserId: userId, email, role: "OWNER" },
    });

    await tx.billingAccount.create({ data: { companyId: company.id } });

    await tx.question.createMany({
      data: DEFAULT_QUESTIONS.map((q, i) => ({
        companyId: company.id,
        phase: q.phase,
        promptText: q.promptText,
        orderIndex: i,
      })),
    });

    return company;
  });

  const stripeCustomer = await stripe.customers.create({
    name: company.name,
    email,
    metadata: { companyId: company.id },
  });
  await prisma.billingAccount.update({
    where: { companyId: company.id },
    data: { stripeCustomerId: stripeCustomer.id },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const checkoutSession = await createSetupFeeCheckoutSession({
    companyId: company.id,
    customerId: stripeCustomer.id,
    successUrl: `${appUrl}/dashboard?setup=success`,
    cancelUrl: `${appUrl}/onboarding?setup=cancelled`,
  });

  redirect(checkoutSession.url!);
}
