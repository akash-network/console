import { Box, Typography } from "@mui/material";
import { StatusPill } from "./StatusPill";

type Props = {
  latency: number;
  status: string;
  variant?: "regular" | "dense";
};

export const NodeStatus: React.FunctionComponent<Props> = ({ latency, status, variant = "regular" }) => {
  return (
    <Box sx={{ display: "flex", alignItems: "center" }}>
      <div>
        <Typography variant="caption" sx={{ fontSize: variant === "regular" ? ".75rem" : ".65rem" }}>
          {latency}ms{latency >= 10000 && "+"}
        </Typography>
      </div>
      <div>
        <StatusPill state={status === "active" ? "active" : "closed"} size={variant === "regular" ? "medium" : "small"} />
      </div>
    </Box>
  );
};
