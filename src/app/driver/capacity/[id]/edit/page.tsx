"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Typography, message } from "antd";
import { DriverShell } from "@/components/DriverShell";
import { BackButton } from "@/components/BackButton";
import { CapacityForm, type CapacityValues } from "@/components/CapacityForm";
import { apiFetch } from "@/lib/client";
import { placeFromText } from "@/lib/places";

export default function EditCapacityPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [initial, setInitial] = useState<CapacityValues | null>(null);
  useEffect(() => {
    (async () => {
      const res = await apiFetch<CapacityValues & { location: string; destPreference?: string | null; status: string }>(`/api/driver/capacity/${id}`);
      if (!res.ok || !res.data) {
        message.error(res.message || "加载失败");
        return;
      }
      if (res.data.status !== "OPEN") {
        message.error("只有未匹配的运力可以编辑");
        router.push(`/driver/capacity/${id}`);
        return;
      }
      const locationPlace = placeFromText(res.data.location || "");
      const destPlace = placeFromText(res.data.destPreference || "");
      setInitial({
        ...res.data,
        locationPlaceId: locationPlace?.id,
        locationAddress: res.data.location,
        destPlaceId: destPlace?.id,
        destAddress: res.data.destPreference || "",
      });
    })();
  }, [id, router]);
  return (
    <DriverShell>
      <BackButton href={`/driver/capacity/${id}`} />
      <Typography.Title level={3}>编辑运力</Typography.Title>
      {initial ? (
        <CapacityForm
          initial={initial}
          submitText="保存"
          onSubmit={async (body) => {
            const res = await apiFetch(`/api/driver/capacity/${id}`, { method: "PATCH", body: JSON.stringify(body) });
            if (!res.ok) {
              message.error(res.message || "保存失败");
              return;
            }
            message.success("已保存");
            router.push(`/driver/capacity/${id}`);
          }}
        />
      ) : null}
    </DriverShell>
  );
}
