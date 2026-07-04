import { redirect } from "next/navigation";

// The subscription screen lives at the top-level /subscription route (no seller
// chrome needed). Keep this alias so direct visits / bookmarks don't 404.
export default function SellerSubscriptionRedirect() {
  redirect("/subscription");
}
