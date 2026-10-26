import type { ComponentType } from "react";
import { Avatar, AvatarFallback } from "@akashnetwork/ui/components";

import { initialsOf } from "@src/utils/initials";

export function MemberAvatar({ name }: { name: string | null | undefined }) {
  return (
    <Avatar className="h-[30px] w-[30px]">
      <AvatarFallback className="text-[11px] font-semibold">{initialsOf(name ?? "?")}</AvatarFallback>
    </Avatar>
  );
}

/** Stands in for an avatar on an event no member caused. */
export function SystemAvatar({ icon: Icon }: { icon: ComponentType<{ className?: string }> }) {
  return (
    <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border border-border bg-muted">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
    </span>
  );
}
