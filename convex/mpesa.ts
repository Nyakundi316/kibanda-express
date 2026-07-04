"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

type StkArgs = {
  paymentId: any;
  phone: string;
  amount: number;
  accountRef: string;
  description: string;
};

function readConfig() {
  const env = (process.env.MPESA_ENV ?? "sandbox").toLowerCase();
  const cfg = {
    consumerKey: process.env.MPESA_CONSUMER_KEY,
    consumerSecret: process.env.MPESA_CONSUMER_SECRET,
    shortcode: process.env.MPESA_SHORTCODE,
    passkey: process.env.MPESA_PASSKEY,
    callbackUrl: process.env.MPESA_CALLBACK_URL,
    baseUrl:
      env === "production"
        ? "https://api.safaricom.co.ke"
        : "https://sandbox.safaricom.co.ke",
  };
  const missing = Object.entries({
    MPESA_CONSUMER_KEY: cfg.consumerKey,
    MPESA_CONSUMER_SECRET: cfg.consumerSecret,
    MPESA_SHORTCODE: cfg.shortcode,
    MPESA_PASSKEY: cfg.passkey,
    MPESA_CALLBACK_URL: cfg.callbackUrl,
  })
    .filter(([, val]) => !val)
    .map(([key]) => key);
  return { cfg, missing };
}

function timestamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    d.getFullYear().toString() +
    p(d.getMonth() + 1) +
    p(d.getDate()) +
    p(d.getHours()) +
    p(d.getMinutes()) +
    p(d.getSeconds())
  );
}

/**
 * Real Safaricom Daraja STK push. When credentials are not yet configured the
 * payment is marked `unconfigured` (the subscription stays pending) — it is
 * NEVER auto-succeeded. Activation can only come from the verified callback.
 */
export const initiateStk = internalAction({
  args: {
    paymentId: v.id("payments"),
    phone: v.string(),
    amount: v.number(),
    accountRef: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args: StkArgs) => {
    const { cfg, missing } = readConfig();
    if (missing.length > 0) {
      await ctx.runMutation(internal.subscriptions.markPaymentUnconfigured, {
        paymentId: args.paymentId,
        reason: `M-Pesa not configured (missing: ${missing.join(", ")})`,
      });
      return;
    }

    try {
      // 1) OAuth token (Basic auth with consumer key/secret).
      const basic = Buffer.from(
        `${cfg.consumerKey}:${cfg.consumerSecret}`
      ).toString("base64");
      const tokenRes = await fetch(
        `${cfg.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
        { headers: { Authorization: `Basic ${basic}` } }
      );
      if (!tokenRes.ok) throw new Error(`OAuth failed (${tokenRes.status})`);
      const token = (await tokenRes.json()).access_token as string;

      // 2) STK push.
      const ts = timestamp();
      const password = Buffer.from(
        `${cfg.shortcode}${cfg.passkey}${ts}`
      ).toString("base64");

      const stkRes = await fetch(
        `${cfg.baseUrl}/mpesa/stkpush/v1/processrequest`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            BusinessShortCode: cfg.shortcode,
            Password: password,
            Timestamp: ts,
            TransactionType: "CustomerPayBillOnline",
            Amount: Math.round(args.amount),
            PartyA: args.phone,
            PartyB: cfg.shortcode,
            PhoneNumber: args.phone,
            CallBackURL: cfg.callbackUrl,
            AccountReference: args.accountRef.slice(0, 12),
            TransactionDesc: args.description.slice(0, 13),
          }),
        }
      );

      const data = await stkRes.json();
      if (!stkRes.ok || data.ResponseCode !== "0") {
        throw new Error(data.errorMessage || data.ResponseDescription || "STK push rejected");
      }

      await ctx.runMutation(internal.subscriptions.attachCheckout, {
        paymentId: args.paymentId,
        merchantRequestId: String(data.MerchantRequestID),
        checkoutRequestId: String(data.CheckoutRequestID),
      });
    } catch (err) {
      await ctx.runMutation(internal.subscriptions.markPaymentFailed, {
        paymentId: args.paymentId,
        reason: err instanceof Error ? err.message : "STK push error",
      });
    }
  },
});
