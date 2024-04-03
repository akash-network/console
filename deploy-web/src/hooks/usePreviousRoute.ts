import routeStore from "@src/store/routeStore";
import { useAtom } from "jotai";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export const usePreviousRoute = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [previousRoute, setPreviousRoute] = useAtom(routeStore.previousRoute);

  useEffect(() => {
    // const handleRouteChange = (url: string) => {
    //   setPreviousRoute(url);
    // };

    if (pathname) {
      const url = pathname + searchParams?.toString();

      if (url !== previousRoute) {
        setPreviousRoute(url);
      }
    }

    // router.events?.on("routeChangeStart", handleRouteChange);

    // return () => {
    //   router.events?.off("routeChangeStart", handleRouteChange);
    // };
  }, [pathname, searchParams]);

  return previousRoute;
};

// function useNavigationEvent() {
//   useEffect(() => {
//     const url = pathname + searchParams.toString();
//     sendSomewhere(url);
//   }, [pathname, searchParams]);
// }
