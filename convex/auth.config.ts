// Convex Auth identity provider config. CONVEX_SITE_URL is injected by the
// deployment automatically, so no manual env var is needed here.
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
