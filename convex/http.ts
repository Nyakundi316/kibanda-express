import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";

const http = httpRouter();

// Convex Auth sign-in / token-refresh routes.
auth.addHttpRoutes(http);

// ---- M-Pesa Daraja STK callback ----
// Safaricom POSTs here after the customer responds to the STK prompt. We never
// trust the client; a subscription is activated only when THIS endpoint
// receives a ResultCode 0 for a checkout request we actually created.
http.route({
  path: "/mpesa/callback",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response("bad request", { status: 400 });
    }

    // Daraja shape: { Body: { stkCallback: { CheckoutRequestID, ResultCode, ... }}}
    const stk = (body as any)?.Body?.stkCallback;
    if (!stk?.CheckoutRequestID) {
      return new Response("ignored", { status: 200 });
    }

    const items: Array<{ Name: string; Value?: string | number }> =
      stk.CallbackMetadata?.Item ?? [];
    const receipt = items.find((i) => i.Name === "MpesaReceiptNumber")?.Value;

    await ctx.runMutation(internal.subscriptions.resolveMpesaCallback, {
      checkoutRequestId: String(stk.CheckoutRequestID),
      resultCode: Number(stk.ResultCode),
      resultDesc: String(stk.ResultDesc ?? ""),
      mpesaReceipt: receipt ? String(receipt) : undefined,
    });

    // Safaricom expects this exact acknowledgement.
    return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }),
});

export default http;
