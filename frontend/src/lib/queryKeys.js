/**
 * React Query key factory. Stable, hierarchical, invalidation-friendly.
 * Rule: everything downstream of `services` invalidates on any service write.
 */
export const qk = {
  auth: {
    me: ["auth", "me"],
  },
  services: {
    all: ["services"],
    list: () => ["services", "list"],
    detail: (id) => ["services", "detail", id],
  },
  dashboard: {
    providerSummary: ["dashboard", "provider-summary"],
  },
};
