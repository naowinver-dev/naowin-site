import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

const METER_EVENT_NAME =
  process.env.STRIPE_DOWNLOAD_METER_EVENT_NAME ?? "testimonial_download";

/**
 * Enregistre un événement de téléchargement facturable auprès du meter
 * Stripe. La tarification par palier (graduated) est configurée côté
 * Stripe sur le prix associé au meter — ce code ne fait que déclarer
 * l'usage.
 */
export async function reportDownloadUsage(params: {
  stripeCustomerId: string;
  quantity?: number;
}): Promise<Stripe.Billing.MeterEvent> {
  return stripe.billing.meterEvents.create({
    event_name: METER_EVENT_NAME,
    payload: {
      stripe_customer_id: params.stripeCustomerId,
      value: String(params.quantity ?? 1),
    },
  });
}

/**
 * Crée une session Stripe Checkout pour le paiement unique du frais de
 * setup à l'inscription d'une entreprise.
 */
export async function createSetupFeeCheckoutSession(params: {
  companyId: string;
  customerId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.create({
    mode: "payment",
    customer: params.customerId,
    line_items: [{ price: process.env.STRIPE_SETUP_FEE_PRICE_ID!, quantity: 1 }],
    // Conserve le moyen de paiement pour la facturation à l'usage qui suit (téléchargements).
    payment_intent_data: { setup_future_usage: "off_session" },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: { companyId: params.companyId, purpose: "setup_fee" },
  });
}

/**
 * Crée l'abonnement metered qui portera la facturation à l'usage
 * (téléchargements) une fois le moyen de paiement enregistré via le
 * Checkout du frais de setup.
 */
export async function createMeteredDownloadSubscription(
  customerId: string,
): Promise<Stripe.Subscription> {
  return stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: process.env.STRIPE_DOWNLOAD_PRICE_ID! }],
  });
}
