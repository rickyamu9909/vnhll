import dayjs from "dayjs";
import { VehicleType } from "@prisma/client";

const VEHICLE_LABEL: Record<VehicleType, { zh: string; vi: string }> = {
  TON_1_5: { zh: "1.5吨", vi: "1.5 tấn" },
  TON_3_5: { zh: "3.5吨", vi: "3.5 tấn" },
  TON_7: { zh: "7吨", vi: "7 tấn" },
  TON_10: { zh: "10吨", vi: "10 tấn" },
  OTHER: { zh: "其他", vi: "Khác" },
};

export type NotifyOrder = {
  orderNo: string;
  pickupAt: Date | string;
  pickupAddress: string;
  pickupContact: string;
  pickupPhone: string;
  pickupNote?: string | null;
  deliveryAddress: string;
  deliveryContact: string;
  deliveryPhone: string;
  cargoName: string;
  cargoWeightKg: number;
  cargoVolumeM3: number;
  vehicleType: VehicleType;
  dealPriceVnd?: bigint | number | string | null;
};

export function buildDriverNotifyMessage(order: NotifyOrder, adminHotline: string) {
  const price =
    order.dealPriceVnd === null || order.dealPriceVnd === undefined
      ? "-"
      : new Intl.NumberFormat("vi-VN").format(Number(order.dealPriceVnd));

  const vehicle = VEHICLE_LABEL[order.vehicleType]?.vi || order.vehicleType;
  const pickupAt = dayjs(order.pickupAt).format("YYYY-MM-DD HH:mm");

  return [
    "【ANTS - Thông báo nhận hàng】",
    `Mã đơn: ${order.orderNo}`,
    "【Nhận hàng】",
    `Thời gian: ${pickupAt}`,
    `Địa chỉ: ${order.pickupAddress}`,
    `Liên hệ: ${order.pickupContact} - ${order.pickupPhone}`,
    `Ghi chú: ${order.pickupNote || "-"}`,
    "【Giao hàng】",
    `Địa chỉ: ${order.deliveryAddress}`,
    `Liên hệ: ${order.deliveryContact} - ${order.deliveryPhone}`,
    "【Hàng hóa】",
    `Tên: ${order.cargoName}`,
    `Khối lượng: ${order.cargoWeightKg} kg`,
    `Thể tích: ${order.cargoVolumeM3} m³`,
    `Loại xe: ${vehicle}`,
    "【Cước phí】",
    `Cước tài xế: ${price} VND`,
    'Vui lòng trả lời "XÁC NHẬN" hoặc gọi lại.',
    `Hotline điều phối: ${adminHotline}`,
  ].join("\n");
}

export { VEHICLE_LABEL };
