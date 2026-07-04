// Pure, client-safe derivation of the customer's order journey. The server
// (convex/lib/orderFlow.ts) stays the source of truth for transitions and
// notifications — this only turns the three status axes into something to look
// at: a stepper, a headline, and an ETA string.

export type JourneyView = {
  status: string;
  deliveryStatus?: string | null;
  fulfilment: string;
  paymentMethod: string;
  paymentStatus: string;
  prepTimeMins?: number | null;
  estimatedArrivalAt?: number | null;
  delayReason?: string | null;
  delayMinutes?: number | null;
};

const DELIVERY_STEPS = ["Placed", "Preparing", "Ready", "Picked up", "On the way", "Delivered"];
const PICKUP_STEPS = ["Placed", "Preparing", "Ready", "Collected"];

export function journeySteps(fulfilment: string): string[] {
  return fulfilment === "delivery" ? DELIVERY_STEPS : PICKUP_STEPS;
}

export function isTerminalBad(status: string): "cancelled" | "rejected" | null {
  if (status === "cancelled") return "cancelled";
  if (status === "rejected") return "rejected";
  return null;
}

/** Index of the current step in `journeySteps`, or -1 when cancelled/rejected. */
export function currentStep(v: JourneyView): number {
  if (isTerminalBad(v.status)) return -1;
  const delivery = v.fulfilment === "delivery";
  const d = v.deliveryStatus ?? "unassigned";

  if (v.status === "completed" || d === "delivered") return delivery ? 5 : 3;

  if (delivery) {
    if (["on_the_way", "near_customer"].includes(d)) return 4;
    if (["picked_up", "at_seller"].includes(d)) return 3;
  }
  if (v.status === "ready") return 2;
  if (v.status === "preparing") return 1;
  if (v.status === "accepted" || v.status === "pending") return 0;
  return 0;
}

/** The big "what's happening now / what's next" line. */
export function statusHeadline(v: JourneyView, riderName?: string | null): { title: string; message: string } {
  const bad = isTerminalBad(v.status);
  if (bad === "cancelled") return { title: "Order cancelled", message: "This order was cancelled." };
  if (bad === "rejected") return { title: "Order rejected", message: "The seller couldn't take this order. Any payment will be refunded." };

  const who = riderName ? `Rider ${riderName}` : "Your rider";
  const d = v.deliveryStatus ?? "unassigned";

  if (v.status === "completed" || d === "delivered") {
    return { title: "Delivered", message: "Your order has been delivered. Enjoy your meal!" };
  }

  // Delivery (rider) axis takes over once the food is ready.
  if (v.fulfilment === "delivery" && v.status === "ready") {
    switch (d) {
      case "unassigned":
        return { title: "Finding a rider", message: "Your food is ready — we're matching you with a rider." };
      case "assigned":
        return { title: "Rider assigned", message: `${who} has been offered your delivery and is confirming.` };
      case "rider_accepted":
      case "going_to_seller":
        return { title: "Rider on the way to the kitchen", message: `${who} is heading to the restaurant to collect your order.` };
      case "at_seller":
        return { title: "Picking up your order", message: `${who} is at the restaurant picking up your food.` };
      case "picked_up":
        return { title: "Order picked up", message: `${who} has your order and is setting off.` };
      case "on_the_way":
        return { title: "On the way", message: `${who} is on the way to you.` };
      case "near_customer":
        return { title: "Rider is nearby", message: `${who} is almost there — please be ready to receive your order.` };
    }
  }

  // Kitchen axis.
  switch (v.status) {
    case "pending":
      return { title: "Waiting for the seller", message: "We've sent your order to the kitchen and are waiting for them to accept." };
    case "accepted":
      return { title: "Order accepted", message: "The seller accepted your order and will start cooking shortly." };
    case "preparing":
      return {
        title: "Food is being prepared",
        message: `The seller is preparing your food${v.prepTimeMins ? `. Estimated prep time: ${v.prepTimeMins} minutes` : ""}.`,
      };
    case "ready":
      return v.fulfilment === "pickup"
        ? { title: "Ready for pickup", message: "Your order is ready — head over to collect it." }
        : { title: "Food is ready", message: "Your food is ready and waiting for a rider." };
    default:
      return { title: "Order in progress", message: "We'll keep you posted as your order moves along." };
  }
}

export function formatEtaShort(ms?: number | null): string {
  if (!ms) return "shortly";
  const diffMin = Math.round((ms - Date.now()) / 60000);
  if (diffMin <= 1) return "any moment now";
  if (diffMin < 60) return `in ${diffMin} min`;
  return `by ${new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

/** Full ETA card text, or null when there's nothing meaningful to show. */
export function etaCard(v: JourneyView, riderName?: string | null): string | null {
  if (isTerminalBad(v.status) || v.status === "completed" || v.deliveryStatus === "delivered") return null;
  if (v.fulfilment === "pickup" && v.status === "ready") return "Ready now for pickup";

  const verb = v.fulfilment === "delivery" ? "Your food should arrive" : "Your order should be ready";
  return `${verb} ${formatEtaShort(v.estimatedArrivalAt)}`;
}
