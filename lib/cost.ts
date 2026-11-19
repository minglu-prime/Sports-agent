/** USD per 1M tokens at DeepSeek's peak rates (api-docs.deepseek.com/quick_start/pricing, checked 2026-11-19).
 *  Peak rates make the daily cap conservative: off-peak calls cost half. */
export const PRICES: Record<string, { in: number; out: number }> = {
  "deepseek-flash": { in: 0.3, out: 1.2 },
  "deepseek-v4-pro": { in: 1.32, out: 3.96 },
};
// ponytail: fixed exchange rate; only feeds a soft daily cap, update by hand if EUR/USD moves a lot
const USD_TO_EUR = 0.92;

export function euros(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICES[model];
  if (!p) throw new Error(`unknown model: ${model}`);
  return ((inputTokens * p.in + outputTokens * p.out) / 1_000_000) * USD_TO_EUR;
}

export const overCap = (spentEuro: number, capEuro: number): boolean => spentEuro >= capEuro;
