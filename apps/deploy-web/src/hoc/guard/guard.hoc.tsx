import FourOhFour from "@src/pages/404";

export const Guard = <P extends object>(Component: React.ComponentType<P>, useCheck: () => boolean, FallbackComponent = FourOhFour) => {
  const WithGuard = (props: P) => {
    const canVisit = useCheck();

    if (canVisit) {
      return <Component {...props} />;
    }

    return <FallbackComponent />;
  };

  const displayName = Component.displayName || Component.name || "Component";

  WithGuard.displayName = `WithGuard(${displayName})`;

  return WithGuard;
};

export const composeGuards = (...guards: (() => boolean)[]) => {
  return () => guards.every(guard => guard());
};
