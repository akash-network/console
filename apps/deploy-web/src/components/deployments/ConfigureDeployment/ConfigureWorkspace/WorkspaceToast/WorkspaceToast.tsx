import type { FC, ReactNode } from "react";

export const WorkspaceToast: FC<{ children: ReactNode }> = ({ children }) => (
  <div className="fixed left-1/2 top-[calc(var(--app-header-height,57px)_+_1rem)] z-30 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-zinc-300 bg-popover p-4 shadow-lg dark:border-zinc-700">
    <div className="flex items-start gap-3">{children}</div>
  </div>
);
