"use client";

import { useRef, useState } from "react";
import { AutoComplete, Spin } from "antd";
import { Form } from "antd";
import { apiFetch } from "@/lib/client";

type Hit = { label: string; lat: number; lng: number; province?: string; ward?: string; address?: string };

export function AddressSuggest({
  side,
  placeholder,
}: {
  side: "origin" | "dest";
  placeholder?: string;
}) {
  const form = Form.useFormInstance();
  const [options, setOptions] = useState<Array<{ value: string; label: string; hit: Hit }>>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addressName = side === "origin" ? "originAddress" : "destAddress";

  const search = (text: string) => {
    if (timer.current) clearTimeout(timer.current);
    if (!text || text.trim().length < 2) {
      setOptions([]);
      return;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      const res = await apiFetch<Hit[]>(`/api/geo/search?q=${encodeURIComponent(text.trim())}`);
      setLoading(false);
      if (!res.ok || !res.data) {
        setOptions([]);
        return;
      }
      setOptions(res.data.map((hit) => ({ value: hit.address || hit.label, label: hit.label, hit })));
    }, 400);
  };

  return (
    <Form.Item name={addressName} label="详细地址">
      <AutoComplete
        allowClear
        options={options}
        onSearch={search}
        placeholder={placeholder || "输入街道可联想越南地址"}
        notFoundContent={loading ? <Spin size="small" /> : null}
        onSelect={(_value, option) => {
          const hit = (option as { hit?: Hit }).hit;
          if (!hit) return;
          form.setFieldsValue(
            side === "origin"
              ? {
                  originProvince: hit.province || form.getFieldValue("originProvince"),
                  originCity: hit.ward || form.getFieldValue("originCity"),
                  originAddress: hit.address || hit.label,
                  originLat: hit.lat,
                  originLng: hit.lng,
                }
              : {
                  destProvince: hit.province || form.getFieldValue("destProvince"),
                  destCity: hit.ward || form.getFieldValue("destCity"),
                  destAddress: hit.address || hit.label,
                  destLat: hit.lat,
                  destLng: hit.lng,
                }
          );
        }}
      />
    </Form.Item>
  );
}
