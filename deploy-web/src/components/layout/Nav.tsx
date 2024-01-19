"use client";
// import { ModeToggle } from "../ModeToggle";
// import { Button } from "../ui/button";
import { AkashConsoleDarkLogo, AkashConsoleLightLogo } from "../icons/AkashConsoleLogo";
import Link from "next/link";
import NetworkSelect from "./NetworkSelect";
// import useCookieTheme from "@/hooks/useTheme";
// import { MobileNav } from "./MobileNav";
import { Github, X as TwitterX, Rocket, Discord } from "iconoir-react";
import { useRouter } from "next/router";
import { UrlService } from "@src/utils/urlUtils";
import { Button } from "../ui/button";

export const Nav = () => {
  const theme = useCookieTheme();
  const router = useRouter();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-header/95 backdrop-blur supports-[backdrop-filter]:bg-header/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          

          <div className="ml-8 hidden md:flex">
            <NetworkSelect />
          </div>
        </div>

        <Link className="flex items-center space-x-2" href="/">
            {theme === "light" ? <AkashConsoleLightLogo className="h-[25px] max-w-[180px]" /> : <AkashConsoleDarkLogo className="h-[25px] max-w-[180px]" />}
          </Link>


          <div sx={{ maxHeight: `${accountBarHeight}px`, alignItems: "center", display: { xs: "none", sm: "none", md: "flex" } }}>
            <div>
              <Link passHref href={UrlService.getStarted()}>
                <StyledBadge overlap="circular" anchorOrigin={{ vertical: "top", horizontal: "right" }} variant="dot">
                  <Button
                    variant="ghost"
                    // sx={{
                    //   textTransform: "initial",
                    //   color: router.pathname === UrlService.getStarted() ? theme.palette.secondary.main : "",
                    //   fontSize: "1rem"
                    // }}
                    disableRipple
                  >
                    Get Started
                  </Button>
                </StyledBadge>
              </Link>
            </div>

            <div sx={{ display: "flex", alignItems: "center" }}>
              <div sx={{ marginLeft: "1rem" }}>
                <WalletStatus />
              </div>

              <AccountMenu />
            </div>
          </div>
      </div>
    </header>
  );
};
