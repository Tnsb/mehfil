/**
 * Payments behind a provider interface.
 *
 * - MockProvider (default, no env vars): checkout is an in-app fake-pay page,
 *   so the whole flow demos with zero setup.
 * - StripeProvider (set STRIPE_SECRET_KEY): real Stripe Checkout in test mode.
 *   Confirmation happens on the success page via session retrieval — no
 *   webhooks needed for v1.
 *
 * Stripe Connect later = a third provider; nothing upstream changes.
 */
import Stripe from "stripe";
import type { Event, Ticket } from "@/db/schema";

export type CheckoutSession = {
  /** where to send the guest to pay */
  url: string;
  /** provider-side reference, if any */
  providerRef?: string;
};

export interface PaymentProvider {
  name: string;
  createCheckout(ticket: Ticket, event: Event, baseUrl: string): Promise<CheckoutSession>;
  /** returns true if the referenced payment is complete */
  verifyPayment(providerRef: string): Promise<boolean>;
}

const mockProvider: PaymentProvider = {
  name: "mock",
  async createCheckout(ticket) {
    return { url: `/pay/${ticket.id}` };
  },
  async verifyPayment() {
    return true;
  },
};

function stripeProvider(secretKey: string): PaymentProvider {
  const stripe = new Stripe(secretKey);
  return {
    name: "stripe",
    async createCheckout(ticket, event, baseUrl) {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: event.priceCents,
              product_data: { name: event.title, description: event.vibe ?? undefined },
            },
            quantity: 1,
          },
        ],
        metadata: { ticketId: ticket.id },
        success_url: `${baseUrl}/e/${event.id}/success?ticket=${ticket.id}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/e/${event.id}`,
      });
      return { url: session.url!, providerRef: session.id };
    },
    async verifyPayment(providerRef) {
      const session = await stripe.checkout.sessions.retrieve(providerRef);
      return session.payment_status === "paid";
    },
  };
}

export function getPaymentProvider(): PaymentProvider {
  const key = process.env.STRIPE_SECRET_KEY;
  return key ? stripeProvider(key) : mockProvider;
}
