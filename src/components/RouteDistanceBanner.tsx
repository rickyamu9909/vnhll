"use client";

import { useEffect, useState } from "react";
import { Alert, Form } from "antd";
import { apiFetch } from "@/lib/client";

export function RouteDistanceBanner() {
  const form = Form.useFormInstance();
  const oLat = Form.useWatch("originLat", form);
  const oLng = Form.useWatch("originLng", form);
  const dLat = Form.useWatch("destLat", form);
  const dLng = Form.useWatch("destLng", form);
  const [label, setLabel] = useState<string>("");

  useEffect(() => {
    const a = Number(oLat);
    const b = Number(oLng);
    const c = Number(dLat);
    const d = Number(dLng);
    if (![a, b, c, d].every(Number.isFinite)) {
      setLabel("");
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await apiFetch<{ label: string }>(`/api/geo/route?oLat=${a}&oLng=${b}&dLat=${c}&dLng=${d}`);
      if (!cancelled && res.ok && res.data?.label) setLabel(res.data.label);
    })();
    return () => {
      cancelled = true;
    };
  }, [oLat, oLng, dLat, dLng]);

  if (!label) return null;
  return <Alert type="info" showIcon style={{ marginBottom: 12 }} message={`运输距离：${label}`} />;
}
