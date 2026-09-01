// Tiện ích DOM nhỏ, tách khỏi component để tránh vi phạm quy tắc immutability của
// react-hooks khi cần chạm vào document trong các pointer handler.
export function setDragCursor(active: boolean) {
  if (typeof document === "undefined") return;
  document.body.style.userSelect = active ? "none" : "";
  document.body.style.cursor = active ? "grabbing" : "";
}
