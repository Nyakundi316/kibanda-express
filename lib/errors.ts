// Convex throws verbose "Uncaught Error: <msg> at handler (...)" strings.
// This pulls out the human part so we can surface it in the UI.
export function humanize(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const cleaned = raw
    .replace(/^\[.*?\]\s*/, "")
    .replace(/^Uncaught\s+/, "")
    .replace(/^(ConvexError|Error):\s*/i, "")
    .split(/\s+at\s+/)[0]
    .trim();

  if (/InvalidSecret|InvalidAccountId/i.test(cleaned))
    return "Wrong email or password.";
  if (/already.*exists|account.*exists/i.test(cleaned))
    return "That email is already registered. Try signing in.";
  return cleaned || "Something went wrong. Please try again.";
}
