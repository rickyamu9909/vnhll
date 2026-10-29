"use client";

import { Image, Space, Typography } from "antd";
import { parseProofPhotos } from "@/lib/proof-photos";

function PhotoRow({ title, photos }: { title: string; photos: string[] }) {
  if (!photos.length) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <Typography.Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
        {title}（点击可放大）· 共 {photos.length} 张
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
  const pickup = parseProofPhotos(pickupPhotos);
  const delivery = parseProofPhotos(deliveryPhotos);
  if (!pickup.length && !delivery.length) return null;
  return (
    <div style={{ marginTop: 16 }}>
      <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>
        履约照片
      </Typography.Title>
      <PhotoRow title="装车照片" photos={pickup} />
      <PhotoRow title="卸车完成照片" photos={delivery} />
    </div>
  );
}
