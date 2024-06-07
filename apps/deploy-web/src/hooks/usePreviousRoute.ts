import { useAtom } from "jotai";
import { useRouter } from "next/router";
import { useEffectOnce } from "usehooks-ts";

import routeStore from "@src/store/routeStore";

export const usePreviousRoute = () => {
  const router = useRouter();
  const [previousRoute, setPreviousRoute] = useAtom(routeStore.previousRoute);

  useEffectOnce(() => {
    const handleRouteChange = (url: string) => {
      setPreviousRoute(url);
    };

    router.events?.on("routeChangeStart", handleRouteChange);

    return () => {
      router.events?.off("routeChangeStart", handleRouteChange);
    };
  });

  return previousRoute;
};
