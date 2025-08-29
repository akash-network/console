import { Loading } from "@src/components/layout/Layout";
import FourOhFour from "@src/pages/404";

type UseCheck = () => {
  canVisit: boolean;
  isLoading: boolean;
};

export const Guard = <P extends object>(Component: React.ComponentType<P>, useCheck: UseCheck, FallbackComponent = FourOhFour) => {
  const WithGuard = (props: P) => {
    const { canVisit, isLoading } = useCheck();

    if (isLoading) {
      return <Loading text="" />;
    }

    if (canVisit) {
      return <Component {...props} />;
    }

    return <FallbackComponent />;
  };

  const displayName = Component.displayName || Component.name || "Component";

  WithGuard.displayName = `WithGuard(${displayName})`;

  return WithGuard;
};

export const composeGuards = (...guards: UseCheck[]): UseCheck => {
  return () => {
    let canVisit = true;
    let isLoading = false;

    for (const guard of guards) {
      const result = guard();
      canVisit &&= result.canVisit;
      isLoading ||= result.isLoading;
    }

    return { canVisit, isLoading };
  };
};
