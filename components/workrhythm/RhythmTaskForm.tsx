"use client";

import { useRef, useState } from "react";
import { createRhythmTask } from "@/lib/rhythm-actions";

type Emp = { id: string; name: string };

export default function RhythmTaskForm({ employees }: { employees: Emp[] }) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn btn-primary btn-sm">
        + Thêm việc
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={createRhythmTask}
      className="card card-pad w-full space-y-3"
      onSubmit={() => setTimeout(() => setOpen(false), 50)}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="md:col-span-2">
          <label className="field-label">Tên việc *</label>
          <input name="title" required placeholder="VD: Đăng 5 bài Facebook + Zalo" className="input" />
        </div>
        <div>
          <label className="field-label">Nhãn / nhóm</label>
          <input name="category" placeholder="VD: Báo cáo" className="input" />
        </div>
        <div>
          <label className="field-label">Áp dụng cho</label>
          <select name="employeeId" className="input">
            <option value="">Tất cả</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Tần suất</label>
          <select name="cadence" className="input">
            <option value="daily">Hằng ngày</option>
            <option value="weekly">Hằng tuần</option>
          </select>
        </div>
        <div>
          <label className="field-label">Kênh (phân tách bởi dấu phẩy)</label>
          <input name="channelsCsv" placeholder="Facebook, Zalo" className="input" />
        </div>
        <div>
          <label className="field-label">Số lần mục tiêu</label>
          <input name="targetCount" type="number" min={0} placeholder="VD: 10" className="input" />
        </div>
        <div>
          <label className="field-label">Bằng chứng tối thiểu</label>
          <input name="evidenceMin" type="number" min={0} defaultValue={0} className="input" />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary btn-sm">
          Lưu
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost btn-sm">
          Huỷ
        </button>
      </div>
    </form>
  );
}
