import type { ComponentType } from "react";
import { Avatar, AvatarFallback } from "@akashnetwork/ui/components";

import { initialsOf } from "@src/utils/initials";

const AVATAR_SHAPE_CLASSES = "h-[30px] w-[30px] shrink-0 rounded-[8px] border border-border bg-muted";

export function MemberAvatar({ name }: { name: string | null | undefined }) {
  return (
    <Avatar className="h-[30px] w-[30px] rounded-[8px]">
      <AvatarFallback className={`${AVATAR_SHAPE_CLASSES} text-[11px] font-semibold`}>{initialsOf(name ?? "?")}</AvatarFallback>
    </Avatar>
  );
}

/** Stands in for an avatar where no member can be shown, such as an event the console caused. */
export function SystemAvatar({ icon: Icon }: { icon: ComponentType<{ className?: string }> }) {
  return (
    <span className={`flex items-center justify-center ${AVATAR_SHAPE_CLASSES}`}>
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
    </span>
  );
}
