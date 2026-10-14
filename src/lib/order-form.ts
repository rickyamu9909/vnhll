export type OrderFormSource = {
  originProvince?: string | null;
  originCity?: string | null;
  originAddress?: string | null;
  pickupAddress?: string | null;
  pickupContact?: string | null;
  pickupPhone?: string | null;
  pickupNote?: string | null;
  pickupAt?: string | null;
  destProvince?: string | null;
  destCity?: string | null;
  destAddress?: string | null;
  deliveryAddress?: string | null;
  deliveryContact?: string | null;
  deliveryPhone?: string | null;
  cargoType?: string | null;
  packaging?: string | null;
  weightTons?: number | null;
  cargoWeightKg?: number | null;
  cargoVolumeM3?: number | null;
  vehicleType?: string | null;
  targetPriceVnd?: string | number | null;
  customerBidVnd?: string | number | null;
  abnormalNote?: string | null;
  etaAt?: string | null;
  cargoItems?: Array<{ lengthCm: number; widthCm: number; heightCm: number; quantity: number }>;
};

export type SavedAddressInput = {
  province: string;
  ward: string;
  address: string;
  contact: string;
  phone: string;
};

export function orderToFormValues(order: OrderFormSource) {
  const price = order.targetPriceVnd || order.customerBidVnd;
  return {
    originProvince: order.originProvince || undefined,
    originCity: order.originCity || undefined,
    originAddress: order.originAddress || order.pickupAddress || "",
    originContact: order.pickupContact || "",
    originPhone: order.pickupPhone || "",
    destProvince: order.destProvince || undefined,
    destCity: order.destCity || undefined,
    destAddress: order.destAddress || order.deliveryAddress || "",
    destContact: order.deliveryContact || "",
    destPhone: order.deliveryPhone || "",
    cargoType: order.cargoType || "GENERAL",
    packaging: order.packaging || "CARTON",
    weightTons: order.weightTons || (order.cargoWeightKg ? order.cargoWeightKg / 1000 : undefined),
    cargoVolumeM3: order.cargoVolumeM3 || undefined,
    vehicleType: order.vehicleType || undefined,
    targetPriceVnd: price ? Number(price) : undefined,
    abnormalNote: order.abnormalNote || undefined,
    note: order.pickupNote || undefined,
    cargoItems: order.cargoItems?.length
      ? order.cargoItems.map((item) => ({
          lengthCm: item.lengthCm,
          widthCm: item.widthCm,
          heightCm: item.heightCm,
          quantity: item.quantity,
        }))
      : [{ quantity: 1 }],
    pickupAt: order.pickupAt,
    etaAt: order.etaAt,
  };
}

export function savedToForm(side: "origin" | "dest", addr: SavedAddressInput) {
  return {
    [`${side}Province`]: addr.province,
    [`${side}City`]: addr.ward,
    [`${side}Address`]: addr.address,
    [`${side}Contact`]: addr.contact,
    [`${side}Phone`]: addr.phone,
  };
}

export function volumeFromItems(items: Array<{ lengthCm?: number; widthCm?: number; heightCm?: number; quantity?: number }>) {
  return items.reduce((sum, item) => {
    const lengthCm = Number(item.lengthCm) || 0;
    const widthCm = Number(item.widthCm) || 0;
    const heightCm = Number(item.heightCm) || 0;
    const quantity = Number(item.quantity) || 0;
    if (!lengthCm || !widthCm || !heightCm || !quantity) return sum;
    return sum + (lengthCm * widthCm * heightCm * quantity) / 1_000_000;
  }, 0);
}

export function pickupIsPast(pickupAt: string | Date | null | undefined, now = new Date()) {
  if (!pickupAt) return false;
  const time = new Date(pickupAt).getTime();
  return Number.isFinite(time) && time < now.getTime();
}
