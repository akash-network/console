import { useTheme } from "@mui/material/styles";
import dynamic from "next/dynamic";

const _DynamicReactJson = dynamic(import("@textea/json-viewer").then(module => module.JsonViewer), { ssr: false });

type Props = {
  src: object;
  collapsed?: number;
};

export const DynamicReactJson: React.FunctionComponent<Props> = ({ src, collapsed = 5 }) => {
  const theme = useTheme();
  return <_DynamicReactJson value={src} theme={theme.palette.mode === "dark" ? "dark" : "light"} defaultInspectDepth={collapsed} />;
};
