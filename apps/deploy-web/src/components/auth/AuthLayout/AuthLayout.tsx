import type { ReactNode } from "react";
import { cn } from "@akashnetwork/ui/utils";
import { DollarSignIcon, RocketIcon, ZapIcon } from "lucide-react";

import { AkashConsoleLogo } from "@src/components/icons/AkashConsoleLogo";
import useCookieTheme from "@src/hooks/useTheme";

interface Props {
  children: ReactNode;
}

export function AuthLayout({ children }: Props) {
  const theme = useCookieTheme();
  const sidebarClass = theme === "dark" ? "bg-[#171717] lg:bg-[hsl(var(--background))]" : "bg-[hsl(var(--background))] dark";

  return (
    <div className="relative flex h-screen">
      <div
        className={cn(
          "absolute flex h-full w-full items-center justify-center overflow-y-auto lg:static lg:w-1/2",
          sidebarClass,
          "bg-[radial-gradient(circle,rgba(255,255,255,0.07)_2px,transparent_2px)]"
        )}
        style={{
          backgroundSize: "24px 24px",
          color: "hsl(var(--foreground))"
        }}
      >
        <div className="hidden max-w-[576px] flex-col gap-6 px-4 lg:flex">
          <AkashConsoleLogo size={{ width: 291, height: 32 }} />
          <p>The fastest way to deploy an application on Akash.Network</p>
          <div className="flex gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[#E5E5E5] bg-white" style={{ color: "hsl(var(--background))" }}>
              <ZapIcon />
            </div>
            <div className="flex-1">
              <h5 className="font-semibold">Generous Free Trial</h5>
              <p className="mt-1">$100 of cloud compute credits so you can test real workloads.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[#E5E5E5] bg-white" style={{ color: "hsl(var(--background))" }}>
              <RocketIcon />
            </div>
            <div className="flex-1">
              <h5 className="font-semibold">Optimized for AI/ML</h5>
              <p className="mt-1">Container native with a library of templates for leading open source AI models and applications.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[#E5E5E5] bg-white" style={{ color: "hsl(var(--background))" }}>
              <DollarSignIcon />
            </div>
            <div className="flex-1">
              <h5 className="font-semibold">Cost Savings</h5>
              <p className="mt-1">The most competitive prices for GPUs on-demand, anywhere on the internet.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex w-full flex-1 items-center justify-center overflow-y-auto px-3 py-4 lg:p-0">{children}</div>
    </div>
  );
}
