import type { ReactNode } from "react";

import useCookieTheme from "@src/hooks/useTheme";

interface Props {
  sidebar: ReactNode;
  children: ReactNode;
}

export function AuthLayout({ sidebar, children }: Props) {
  const theme = useCookieTheme();
  const inversedClass = theme === "dark" ? "bg-[#171717]" : "dark";
  return (
    <div className="relative flex h-screen">
      <div
        className={`absolute flex h-full w-full items-center justify-center overflow-y-auto bg-[hsl(var(--background))] lg:relative lg:w-1/2 ${inversedClass}`}
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
