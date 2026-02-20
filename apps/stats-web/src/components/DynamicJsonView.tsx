import { lazy, Suspense } from "react";
import { Spinner } from "@akashnetwork/ui/components";
import { useTheme } from "next-themes";

const JsonViewer = lazy(() => import("@textea/json-viewer").then(module => ({ default: module.JsonViewer })));

type Props = {
  src: object;
  collapsed?: number;
};

export const DynamicReactJson: React.FunctionComponent<Props> = ({ src, collapsed = 5 }) => {
  const { resolvedTheme } = useTheme();
  return (
    <Suspense
      fallback={
        <div className="flex items-center text-sm text-muted-foreground">
          Loading... <Spinner size="small" className="ml-2" />
        </div>
      }
    >
      <JsonViewer value={src} theme={resolvedTheme === "dark" ? "dark" : "light"} defaultInspectDepth={collapsed} />
    </Suspense>
  );
};
