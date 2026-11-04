import { cn } from "@akashnetwork/ui/utils";
import { User } from "lucide-react";

import type { OrganizationOutput } from "@src/types/organization";

const FNV_OFFSET_BASIS = 2166136261;

const FNV_PRIME = 16777619;

const PERSONAL_AVATAR_CLASSES = "inline-flex shrink-0 items-center justify-center border border-border bg-muted text-muted-foreground";

/** FNV-1a over the seed, so the same seed draws the same hue wherever it is shown. */
export function hueOf(seed: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (let index = 0; index < seed.length; index++) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return (hash >>> 0) % 360;
}

type Props = {
  organization: Pick<OrganizationOutput, "id" | "name" | "type">;
  size?: number;
  className?: string;
};

export function OrganizationAvatar({ organization, size = 22, className }: Props) {
  const borderRadius = Math.round(size * 0.28);

  if (organization.type === "personal") {
    const iconSize = Math.round(size * 0.6);
    return (
      <span
        aria-hidden="true"
        className={cn(PERSONAL_AVATAR_CLASSES, className)}
        style={{ width: size, height: size, borderRadius }}
      >
        <User style={{ width: iconSize, height: iconSize }} />
      </span>
    );
  }

  const initial = (organization.name.trim().charAt(0) || "?").toUpperCase();
  const fontSize = Math.round(size * 0.48);
  const hue = hueOf(organization.id);

  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex shrink-0 items-center justify-center leading-none", className)}
      style={{
        width: size,
        height: size,
        borderRadius,
        background: `oklch(0.93 0.05 ${hue})`,
        color: `oklch(0.38 0.13 ${hue})`,
        boxShadow: `inset 0 0 0 1px oklch(0.84 0.07 ${hue})`,
        fontSize,
        fontWeight: 650
      }}
    >
      {initial}
    </span>
  );
}
