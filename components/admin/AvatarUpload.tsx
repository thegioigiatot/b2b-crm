"use client";

import { useRef, useState } from "react";
import { initials } from "@/lib/format";

// Thu nhỏ ảnh về tối đa `size` px rồi trả data URL (JPEG). Không cần cloud storage.
function fileToDataUrl(file: File, size = 160): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read"));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, size / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("ctx"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => reject(new Error("img"));
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function AvatarUpload({
  name = "photoUrl",
  defaultValue,
  displayName,
}: {
  name?: string;
  defaultValue: string | null;
  displayName: string;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [showUrl, setShowUrl] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setErr("Ảnh quá lớn (tối đa 5MB).");
      return;
    }
    setErr("");
    setBusy(true);
    try {
      setValue(await fileToDataUrl(file));
    } catch {
      setErr("Không đọc được ảnh.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-start gap-4">
      <input type="hidden" name={name} value={value} />
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className="h-16 w-16 rounded-full object-cover border border-slate-200" />
      ) : (
        <span className="avatar" style={{ width: 64, height: 64, fontSize: 20 }}>
          {initials(displayName)}
        </span>
      )}
      <div className="space-y-1.5">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="btn btn-ghost btn-sm"
          >
            {busy ? "Đang xử lý…" : "Tải ảnh lên"}
          </button>
          <button type="button" onClick={() => setShowUrl((v) => !v)} className="btn btn-ghost btn-sm">
            Dùng URL
          </button>
          {value && (
            <button type="button" onClick={() => setValue("")} className="btn btn-ghost btn-sm text-rose-600">
              Xoá ảnh
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
        {showUrl && (
          <input
            type="url"
            placeholder="https://…/avatar.jpg"
            value={value.startsWith("data:") ? "" : value}
            onChange={(e) => setValue(e.target.value)}
            className="input"
            style={{ minWidth: 260 }}
          />
        )}
        {err && <p className="text-xs text-rose-600">{err}</p>}
        <p className="text-[11px] text-slate-400">Ảnh được thu nhỏ 160px, lưu trực tiếp — không cần dịch vụ ngoài.</p>
      </div>
    </div>
  );
}
