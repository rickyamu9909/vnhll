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

/** 佣金 = 成交价 × bps / 10000，默认 20% = 2000 bps */
export function calcByBps(priceVnd: bigint, bps: number) {
  const fee = (priceVnd * BigInt(bps)) / BigInt(10000);
  return { platformFeeVnd: fee, driverIncomeVnd: priceVnd - fee };
}

export function calcCommission(driverPriceVnd: bigint, bps = 2000) {
  return calcByBps(driverPriceVnd, bps);
}

export function serializeMoney<T extends Record<string, unknown>>(obj: T) {
  const out: Record<string, unknown> = { ...obj };
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === "bigint") out[k] = v.toString();
  }
  return out;
}
