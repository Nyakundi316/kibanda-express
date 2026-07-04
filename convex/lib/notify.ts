import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

type Notification = {
  userId: Id<"users">;
  orderId?: Id<"marketplaceOrders">;
  kind: string;
  title: string;
  body: string;
};

/**
 * Single place every customer-facing notification flows through. Writes the
 * real in-app row (live via Convex) and then fans out to external channels.
 *
 * External channels are intentionally stubbed — see `sendExternal`. They are
 * NOT wired to providers yet, so this never silently "pretends" to send.
 */
export async function dispatch(ctx: MutationCtx, n: Notification): Promise<void> {
  await ctx.db.insert("orderNotifications", {
    userId: n.userId,
    orderId: n.orderId,
    kind: n.kind,
    title: n.title,
    body: n.body,
    read: false,
    createdAt: Date.now(),
  });

  await sendExternal(ctx, n);
}

/**
 * Outbound bridge for SMS / WhatsApp / push / email. Deliberately a no-op for
 * now: each branch documents exactly what needs wiring + which credentials.
 * Plug providers in here without touching any caller.
 */
async function sendExternal(_ctx: MutationCtx, n: Notification): Promise<void> {
  // TODO(sms): Africa's Talking / Twilio. Needs SMS_* creds + a "use node"
  //            action (HTTP can't run inside a mutation). Schedule via
  //            ctx.scheduler.runAfter(0, internal.<smsAction>, {...}).
  // TODO(whatsapp): WhatsApp Cloud API template message.
  // TODO(push): Web Push / FCM — requires stored subscription tokens.
  // TODO(email): Resend / SES — only if the customer has a verified email.
  if (process.env.NOTIFY_DEBUG) {
    // Visible in `npx convex logs` during development.
    console.log(`[notify:${n.kind}] -> ${n.title}: ${n.body}`);
  }
}
