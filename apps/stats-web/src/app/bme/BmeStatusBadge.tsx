const STATUS_COLORS: Record<string, string> = {
  healthy: "bg-green-500/20 text-green-700 dark:text-green-400",
  warning: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
  halt: "bg-red-500/20 text-red-700 dark:text-red-400"
};

const SIZE_CLASSES = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-3 py-1 text-sm"
} as const;

export function BmeStatusBadge({ status, size = "md" }: { status: string; size?: keyof typeof SIZE_CLASSES }) {
  const colorClass = STATUS_COLORS[status] ?? "bg-muted text-muted-foreground";

  return <span className={`inline-block rounded-full font-semibold capitalize ${SIZE_CLASSES[size]} ${colorClass}`}>{status}</span>;
}
