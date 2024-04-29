"use client";
import Battery0BarIcon from "@mui/icons-material/Battery0Bar";
import Battery1BarIcon from "@mui/icons-material/Battery1Bar";
import Battery2BarIcon from "@mui/icons-material/Battery2Bar";
import Battery3BarIcon from "@mui/icons-material/Battery3Bar";
import Battery4BarIcon from "@mui/icons-material/Battery4Bar";
import Battery5BarIcon from "@mui/icons-material/Battery5Bar";
import Battery6BarIcon from "@mui/icons-material/Battery6Bar";
import BatteryFullIcon from "@mui/icons-material/BatteryFull";
import BatteryUnknownIcon from "@mui/icons-material/BatteryUnknown";

type Props = {
  /** Between 0 and 1 */
  value: number;
  fontSize?: "small" | "inherit" | "medium" | "large";
};

export const CapacityIcon: React.FunctionComponent<Props> = ({ value, fontSize = "medium" }) => {
  if (value === 0) return <Battery0BarIcon color="disabled" fontSize={fontSize} />;
  else if (value < 0.16) return <Battery1BarIcon color="disabled" fontSize={fontSize} />;
  else if (value < 0.32) return <Battery2BarIcon color="disabled" fontSize={fontSize} />;
  else if (value < 0.48) return <Battery3BarIcon color="primary" className="opacity-60" fontSize={fontSize} />;
  else if (value < 0.64) return <Battery4BarIcon color="primary" className="opacity-60" fontSize={fontSize} />;
  else if (value < 0.8) return <Battery5BarIcon color="primary" className="opacity-80" fontSize={fontSize} />;
  else if (value < 1) return <Battery6BarIcon color="primary" fontSize={fontSize} />;
  else if (value === 1) return <BatteryFullIcon color="primary" fontSize={fontSize} />;

  return <BatteryUnknownIcon color="disabled" fontSize={fontSize} />;
};
