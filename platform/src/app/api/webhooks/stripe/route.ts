import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe, createMeteredDownloadSubscription } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature!,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const companyId = session.metadata?.companyId;
    if (companyId && session.metadata?.purpose === "setup_fee") {
      const subscription = await createMeteredDownloadSubscription(
        session.customer as string,
      );

      await prisma.$transaction([
        prisma.company.update({
          where: { id: companyId },
          data: { setupFeePaidAt: new Date() },
        }),
        prisma.billingAccount.update({
          where: { companyId },
          data: { setupFeeStatus: "PAID", stripeSubscriptionId: subscription.id },
        }),
      ]);
    }
  }

  return NextResponse.json({ received: true });
}
