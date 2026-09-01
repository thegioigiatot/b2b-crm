import clsx from "clsx";

const MAP: Record<string, string> = {
  Nóng: "chip-hot",
  Ấm: "chip-warm",
  Nguội: "chip-cold",
  Lạnh: "chip-cold",
};

const DOT: Record<string, string> = {
  Nóng: "🔥",
  Ấm: "🌤️",
  Nguội: "❄️",
  Lạnh: "❄️",
};

export default function ScoreBadge({
  label,
  grade,
  className,
  showIcon = true,
}: {
  label: string;
  grade?: string | number | null;
  className?: string;
  showIcon?: boolean;
}) {
  return (
    <span className={clsx("chip", MAP[label] ?? "chip-slate", className)}>
      {showIcon && <span>{DOT[label] ?? "•"}</span>}
      {label}
      {grade != null && grade !== "" && <span className="opacity-60">· {grade}</span>}
    </span>
  );
}
