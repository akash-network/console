import { Avatar, AvatarFallback } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";

import type { OrganizationOutput } from "@src/types/organization";

const FNV_OFFSET_BASIS = 2166136261;

const FNV_PRIME = 16777619;

/** FNV-1a over the name, so an organization keeps the same hue wherever it is drawn. */
export function organizationHue(name: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (let index = 0; index < name.length; index++) {
    hash ^= name.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return (hash >>> 0) % 360;
}

type Props = {
  organization: Pick<OrganizationOutput, "name" | "type">;
  size?: number;
  className?: string;
};

export function OrganizationAvatar({ organization, size = 22, className }: Props) {
  const initial = (organization.name.trim().charAt(0) || "?").toUpperCase();
  const fontSize = Math.round(size * 0.48);

  if (organization.type === "personal") {
    return (
      <Avatar aria-hidden="true" className={cn("shrink-0", className)} style={{ width: size, height: size }}>
        <AvatarFallback className="bg-accent font-semibold text-foreground" style={{ fontSize }}>
          {initial}
        </AvatarFallback>
      </Avatar>
    );
  }

  const hue = organizationHue(organization.name);

  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex shrink-0 items-center justify-center leading-none", className)}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
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
