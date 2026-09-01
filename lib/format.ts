export function formatCurrency(value: number | null | undefined) {
  if (value == null) return "-";
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value) + " đ";
}

export function formatNumber(value: number | null | undefined) {
  if (value == null) return "-";
  return new Intl.NumberFormat("vi-VN").format(value);
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

export function formatMonth(value: Date | string | null | undefined) {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  return `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`;
}

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

// Khoảng cách thời gian tương đối, tiếng Việt ngắn gọn (vd "3 ngày trước", "vừa xong").
export function relativeTime(value: Date | string | null | undefined) {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  const diffMs = Date.now() - d.getTime();
  const abs = Math.abs(diffMs);
  const min = 60_000;
  const hour = 60 * min;
  const day = 24 * hour;
  const suffix = diffMs >= 0 ? " trước" : " nữa";
  if (abs < min) return "vừa xong";
  if (abs < hour) return `${Math.round(abs / min)} phút${suffix}`;
  if (abs < day) return `${Math.round(abs / hour)} giờ${suffix}`;
  if (abs < 30 * day) return `${Math.round(abs / day)} ngày${suffix}`;
  if (abs < 365 * day) return `${Math.round(abs / (30 * day))} tháng${suffix}`;
  return `${Math.round(abs / (365 * day))} năm${suffix}`;
}

// Số ngày trọn vẹn kể từ `value` đến hiện tại (>= 0).
export function daysSince(value: Date | string | null | undefined) {
  if (!value) return 0;
  const d = typeof value === "string" ? new Date(value) : value;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000));
}

// Số ngày còn lại đến `value` (âm nếu đã qua). null nếu không có ngày.
export function daysUntil(value: Date | string | null | undefined) {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}

// Viết tắt tên -> tối đa 2 ký tự cho avatar chữ.
export function initials(name: string | null | undefined) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatPercent(value: number | null | undefined) {
  if (value == null) return "-";
  return new Intl.NumberFormat("vi-VN", { style: "percent", maximumFractionDigits: 1 }).format(value);
}

export function monthValue(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthRange(monthStr: string) {
  const [y, m] = monthStr.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);
  return { start, end };
}

export function monthLabel(monthStr: string) {
  const [y, m] = monthStr.split("-").map(Number);
  return `Th${m}/${y}`;
}
