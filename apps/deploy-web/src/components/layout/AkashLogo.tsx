import { cn } from "@akashnetwork/ui/utils";

import useCookieTheme from "@src/hooks/useTheme";
import { AkashConsoleLogoDark, AkashConsoleLogoLight } from "../icons/AkashConsoleLogo";

export const AkashLogo = ({ className, size = { width: 200, height: 19 } }: { className?: string; size?: { width: number; height: number } }) => {
  const theme = useCookieTheme();
  return theme === "light" ? (
    <AkashConsoleLogoLight className={cn(`h-[${size.height}px] max-w-[${size.width}px]`, className)} />
  ) : (
    <AkashConsoleLogoDark className={cn(`h-[${size.height}px] max-w-[${size.width}px]`, className)} />
  );
};
