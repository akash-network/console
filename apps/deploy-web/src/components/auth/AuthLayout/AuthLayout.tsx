import type { ReactNode } from "react";

import useCookieTheme from "@src/hooks/useTheme";

interface Props {
  sidebar: ReactNode;
  children: ReactNode;
}

export function AuthLayout({ sidebar, children }: Props) {
  const theme = useCookieTheme();
  const sidebarClass = theme === "dark" ? "bg-[#171717] lg:bg-[hsl(var(--background))]" : "bg-[hsl(var(--background))] dark";
  return (
    <div className="relative flex h-screen">
      <div
        className={`absolute flex h-full w-full items-center justify-center overflow-y-auto lg:static lg:w-1/2 ${sidebarClass}`}
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255, 255, 255, 0.07) 2px, transparent 2px)",
          backgroundSize: "24px 24px",
          color: "hsl(var(--foreground))"
        }}
      >
        {sidebar}
      </div>

      <div className="relative z-10 flex w-full flex-1 items-center justify-center overflow-y-auto px-3 py-4 lg:p-0">{children}</div>
    </div>
  );
}
