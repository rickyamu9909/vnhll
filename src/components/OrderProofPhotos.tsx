"use client";

import { Image, Space, Typography } from "antd";
import { useI18n } from "@/components/I18nProvider";
import { parseProofPhotos } from "@/lib/proof-photos";

function PhotoRow({ title, photos, tip }: { title: string; photos: string[]; tip: string }) {
  if (!photos.length) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <Typography.Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
        {title}
        {tip}
      </Typography.Text>
      <Image.PreviewGroup>
        <Space wrap size={8}>
          {photos.map((src, index) => (
            <Image
              key={`${title}-${index}`}
              src={src}
              alt={`${title}-${index + 1}`}
              width={88}
              height={88}
              style={{ objectFit: "cover", borderRadius: 6, border: "1px solid #e5e7eb" }}
            />
          ))}
        </Space>
      </Image.PreviewGroup>
    </div>
  );
}

/** 订单详情中展示装车 / 卸车照片，客户与司机共用 */
export function OrderProofPhotos({
  pickupPhotos,
  deliveryPhotos,
}: {
  pickupPhotos?: string | string[] | null;
  deliveryPhotos?: string | string[] | null;
}) {
  const { t } = useI18n();
  const pickup = parseProofPhotos(pickupPhotos);
  const delivery = parseProofPhotos(deliveryPhotos);
  if (!pickup.length && !delivery.length) return null;
  return (
    <div style={{ marginTop: 16 }}>
      <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>
        {t("order.proof", "履约照片")}
      </Typography.Title>
      <PhotoRow
        title={t("order.proof_pickup", "装车照片")}
        tip={t("order.proof_click", "（点击可放大）· 共 {n} 张").replace("{n}", String(pickup.length))}
        photos={pickup}
      />
      <PhotoRow
        title={t("order.proof_delivery", "卸车完成照片")}
        tip={t("order.proof_click", "（点击可放大）· 共 {n} 张").replace("{n}", String(delivery.length))}
        photos={delivery}
      />
    </div>
  );
}
