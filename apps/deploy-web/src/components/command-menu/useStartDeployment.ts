import { useCallback } from "react";
import { usePopup } from "@akashnetwork/ui/context";
import { usePathname, useRouter } from "next/navigation";

import { useServices } from "@src/context/ServicesProvider";
import { UrlService } from "@src/utils/urlUtils";

export type DeploymentStart = "new-deployment" | "container" | "linux";

const START_URLS: Record<DeploymentStart, string> = {
  "new-deployment": UrlService.newDeployment(),
  container: UrlService.configureDeployment({}),
  linux: UrlService.configureDeployment({ vm: true })
};

const CONFIGURE_PATH = UrlService.configureDeployment({});

export const DEPENDENCIES = { useRouter, usePathname, usePopup };

export function useStartDeployment(dependencies: typeof DEPENDENCIES = DEPENDENCIES) {
  const router = dependencies.useRouter();
  const pathname = dependencies.usePathname();
  const { confirm } = dependencies.usePopup();
  const { windowLocation } = useServices();

  return useCallback(
    async (kind: DeploymentStart) => {
      const url = START_URLS[kind];

      if (!pathname?.startsWith(CONFIGURE_PATH)) {
        router.push(url);
        return;
      }

      const isConfirmed = await confirm({ title: "Discard your changes?", message: "You'll leave this configuration and start a new deployment." });
      if (!isConfirmed) return;

      if (url.startsWith(CONFIGURE_PATH)) {
        reloadConfigure(windowLocation, url);
      } else {
        router.push(url);
      }
    },
    [pathname, router, confirm, windowLocation]
  );
}

/** Configure keeps its draft session across navigations within the page, so only a full load starts a fresh one. */
function reloadConfigure(location: Pick<Location, "assign">, url: string) {
  location.assign(url);
}
