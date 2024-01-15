import { useTheme } from "next-themes";
import dynamic from "next/dynamic";
import Spinner from "./Spinner";

const _DynamicReactJson = dynamic(() => import("@textea/json-viewer").then(module => module.JsonViewer), {
  ssr: false,
  loading: () => (
    <div className="flex items-center text-sm text-muted-foreground">
      Loading... <Spinner size="small" className="ml-2" />
    </div>
  )
});

type Props = {
  src: object;
  collapsed?: number;
};

export const DynamicReactJson: React.FunctionComponent<Props> = ({ src, collapsed = 5 }) => {
  const { theme } = useTheme();
  return <_DynamicReactJson value={src} theme={theme === "dark" ? "dark" : "light"} defaultInspectDepth={collapsed} />;
};
