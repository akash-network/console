import React, { useLayoutEffect, useRef } from "react";
import { WarningTriangle } from "iconoir-react";
import Link from "next/link";

import { topBannerHeightCssVar } from "@src/utils/constants";

const PROVIDER_PLAYBOOK_URL = "https://akash.network/docs/providers/setup-and-installation/provider-playbook/";

export function ProviderBuildDisabledBanner() {
  const bannerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(function publishBannerHeight() {
    const banner = bannerRef.current;
    if (!banner) return;

    const updateBannerHeight = () => {
      document.documentElement.style.setProperty(topBannerHeightCssVar, `${banner.offsetHeight}px`);
    };
    updateBannerHeight();

    const resizeObserver = new ResizeObserver(updateBannerHeight);
    resizeObserver.observe(banner);

    return function stopPublishingBannerHeight() {
      resizeObserver.disconnect();
      document.documentElement.style.removeProperty(topBannerHeightCssVar);
    };
  }, []);

  return (
    <div ref={bannerRef} className="fixed top-0 z-[1100] w-full">
      <div role="alert" className="bg-primary text-primary-foreground flex items-center justify-center gap-2 px-4 py-2 text-center text-xs">
        <WarningTriangle className="h-4 w-4 flex-shrink-0" />
        <span>
          Provider builds are disabled in Provider Console. Use the{" "}
          <Link href={PROVIDER_PLAYBOOK_URL} target="_blank" rel="noreferrer" className="text-primary-foreground font-semibold underline">
            Provider Playbook
          </Link>{" "}
          to build providers. Provider Console remains available for dashboards and management.
        </span>
      </div>
    </div>
  );
}
