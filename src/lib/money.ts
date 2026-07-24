export function formatVnd(value: bigint | number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";
  const n = typeof value === "bigint" ? Number(value) : Number(value);
  if (Number.isNaN(n)) return "-";
  return new Intl.NumberFormat("vi-VN").format(n);
}

export function toBigIntMoney(value: number | string) {
  const n = typeof value === "string" ? Number(value.replace(/,/g, "")) : value;
  if (!Number.isFinite(n) || n < 0) throw new Error("Invalid money amount");
  return BigInt(Math.round(n));
}

/** 平台佣金 = 司机报价 × 15%，司机实得 = 报价 - 佣金 */
export function calcCommission(driverPriceVnd: bigint) {
  const fee = (driverPriceVnd * BigInt(15)) / BigInt(100);
  const income = driverPriceVnd - fee;
  return { platformFeeVnd: fee, driverIncomeVnd: income };
}

export function serializeMoney<T extends Record<string, unknown>>(obj: T) {
  const out: Record<string, unknown> = { ...obj };
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === "bigint") out[k] = v.toString();
  }
  return out;
}
