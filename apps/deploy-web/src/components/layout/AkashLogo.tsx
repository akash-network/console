import { cn } from "@akashnetwork/ui/utils";

import useCookieTheme from "@src/hooks/useTheme";
import { AkashConsoleLogoDark, AkashConsoleLogoLight } from "../icons/AkashConsoleLogo";

export const AkashLogo = ({ className, size = { width: 170, height: 20 } }: { className?: string; size?: { width: number; height: number } }) => {
  const theme = useCookieTheme();
  return theme === "light" ? <AkashConsoleLogoLight className={cn(className)} size={size} /> : <AkashConsoleLogoDark className={cn(className)} size={size} />;
};
