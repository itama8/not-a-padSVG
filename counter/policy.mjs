// Click budgets, not message budgets: batching must not bypass detection.
export const SESSION_TTL = 7 * 86400_000;
export const FLAG_TTL = 86400_000;
export const BUDGETS = {
  session: { capacity: 120, perSecond: 12 },
  ip: { capacity: 600, perSecond: 60 },
};

export function spend(previous, delta, now, budget) {
  const state = previous ?? { tokens: budget.capacity, updated: now, flaggedUntil: 0 };
  const tokens = Math.min(budget.capacity,
    state.tokens + Math.max(0, now - state.updated) * budget.perSecond / 1000);
  const suspicious = state.flaggedUntil > now || delta > tokens;
  return {
    tokens: Math.max(0, tokens - delta), updated: now,
    flaggedUntil: suspicious ? (state.flaggedUntil > now ? state.flaggedUntil : now + FLAG_TTL) : 0,
  };
}
