import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

// Email + password identity. Roles live in the `profiles` table and are written
// only by server code (see lib/rbac.ts) — never by the auth provider — so a
// client can never sign itself up as a seller or admin.
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password],
  callbacks: {
    // Runs right after a user is created/updated by the auth flow. We give every
    // new member a default `customer` profile so role data always exists — the
    // role can only be elevated later by server code (payment / admin action).
    async afterUserCreatedOrUpdated(ctx, { userId }) {
      const existing = await ctx.db
        .query("profiles")
        .filter((q) => q.eq(q.field("userId"), userId))
        .first();
      if (!existing) {
        await ctx.db.insert("profiles", {
          userId,
          role: "customer",
          createdAt: Date.now(),
        });
      }
    },
  },
});
