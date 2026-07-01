// Shared in-memory invite token store.
// For multi-instance deployments, replace with Redis (HSET/HGET with TTL).
const store = new Map<string, {
  companyId: string;
  email: string;
  role: string;
  name: string;
  expiresAt: number;
}>();

export const inviteStore = store;
