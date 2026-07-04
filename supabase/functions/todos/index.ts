import { withSupabase } from "@supabase/server";

// Edge Function: GET /functions/v1/todos
// withSupabase verifies the caller's JWT (via SUPABASE_JWKS_URL) and injects:
//   ctx.supabase      → RLS-scoped client, acts as the signed-in user
//   ctx.supabaseAdmin → service client that bypasses RLS (use sparingly)
export default {
  fetch: withSupabase({ auth: "user" }, async (_req, ctx) => {
    const { data, error } = await ctx.supabase.from("todos").select();

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json(data);
  }),
};
