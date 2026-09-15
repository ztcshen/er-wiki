// One soft deadline per request; sub-stages may shorten it, never extend it.
export function layoutBudget({ now = () => performance.now(), softBudgetMs = 23000 } = {}) {
  const started = now(), deadline = started + Math.max(0, Math.min(23000, softBudgetMs));
  return { now, started, deadline, expired: () => now() >= deadline,
    remaining: () => Math.max(0, deadline - now()) };
}
