"use client";

import { useState } from "react";
import { Upload, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";

async function compressImage(file: File) {
  const bitmap = await createImageBitmap(file);
  const maxEdge = 1280;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法处理图片");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  let quality = 0.72;
  let data = canvas.toDataURL("image/jpeg", quality);
  while (data.length > 180_000 && quality > 0.45) {
    quality -= 0.08;
    data = canvas.toDataURL("image/jpeg", quality);
  }
  return data;
}

export function PhotoPicker({ value, onChange }: { value?: string; onChange?: (value: string) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Upload
      accept="image/*"
      listType="picture-card"
      maxCount={1}
      showUploadList={false}
      disabled={busy}
      beforeUpload={async (file) => {
        if (!file.type.startsWith("image/")) {
          message.error("请选择图片文件");
          return false;
        }
        setBusy(true);
        try {
          const data = await compressImage(file);
          onChange?.(data);
        } catch {
          message.error("图片处理失败");
        } finally {
          setBusy(false);
        }
        return false;
      }}
    >
      {value ? (
        <img src={value} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <div>
          <PlusOutlined />
          <div style={{ marginTop: 4, fontSize: 12 }}>{busy ? "处理中" : "上传"}</div>
        </div>
      )}
    </Upload>
  );
}
