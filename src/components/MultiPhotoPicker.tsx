"use client";

import { useState } from "react";
import { Upload, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import type { UploadFile } from "antd/es/upload/interface";

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

function toFileList(urls: string[]): UploadFile[] {
  return urls.map((url, index) => ({
    uid: `proof-${index}-${url.slice(-24)}`,
    name: `photo-${index + 1}.jpg`,
    status: "done",
    url,
  }));
}

/** 多图选择：压缩后以 data URL 数组回传，最多 maxCount 张 */
export function MultiPhotoPicker({
  value = [],
  onChange,
  maxCount = 6,
}: {
  value?: string[];
  onChange?: (value: string[]) => void;
  maxCount?: number;
}) {
  const [busy, setBusy] = useState(false);
  const fileList = toFileList(value);

  return (
    <Upload
      accept="image/*"
      listType="picture-card"
      multiple
      maxCount={maxCount}
      fileList={fileList}
      disabled={busy}
      onRemove={(file) => {
        const next = value.filter((url) => url !== file.url);
        onChange?.(next);
      }}
      beforeUpload={async (file) => {
        if (!file.type.startsWith("image/")) {
          message.error("请选择图片文件");
          return false;
        }
        if (value.length >= maxCount) {
          message.warning(`最多上传 ${maxCount} 张`);
          return false;
        }
        setBusy(true);
        try {
          const data = await compressImage(file);
          onChange?.([...value, data].slice(0, maxCount));
        } catch {
          message.error("图片处理失败");
        } finally {
          setBusy(false);
        }
        return false;
      }}
    >
      {value.length >= maxCount ? null : (
        <div>
          <PlusOutlined />
          <div style={{ marginTop: 4, fontSize: 12 }}>{busy ? "处理中" : "上传"}</div>
        </div>
      )}
    </Upload>
  );
}
