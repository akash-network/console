const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  healthy: { color: "bg-green-500/20 text-green-400", label: "Healthy" },
  warning: { color: "bg-yellow-500/20 text-yellow-400", label: "Warning" },
  halt: { color: "bg-red-500/20 text-red-400", label: "Halted" }
};

const SIZE_CLASSES = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-3 py-1 text-sm"
} as const;

function parseStatus(raw: string): string {
  return raw.replace(/^mint_status_/i, "").toLowerCase();
}

export function BmeStatusBadge({ status, size = "md" }: { status: string; size?: keyof typeof SIZE_CLASSES }) {
  const key = parseStatus(status);
  const config = STATUS_CONFIG[key];
  const colorClass = config?.color ?? "bg-muted text-muted-foreground";
  const label = config?.label ?? key;

  return <span className={`inline-block rounded-full font-semibold ${SIZE_CLASSES[size]} ${colorClass}`}>{label}</span>;
}
