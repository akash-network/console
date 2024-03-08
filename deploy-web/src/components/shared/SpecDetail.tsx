"use client";
import { bytesToShrink } from "@src/utils/unitUtils";
import { roundDecimal } from "@src/utils/mathHelpers";
import { cn } from "@src/utils/styleUtils";
import { Badge } from "../ui/badge";
import { MdDeveloperBoard, MdMemory, MdSpeed, MdStorage } from "react-icons/md";
import { useTheme } from "next-themes";

export function SpecDetail({
  cpuAmount,
  memoryAmount,
  storageAmount,
  gpuAmount = 0,
  gpuModels,
  color = "default",
  size = "large",
  gutterSize = "large"
}: React.PropsWithChildren<{
  cpuAmount: number;
  memoryAmount: number;
  storageAmount: number;
  gpuAmount: number;
  gpuModels?: { vendor: string; model: string }[];
  color: string;
  size: "small" | "medium" | "large";
  gutterSize: "small" | "medium" | "large";
}>) {
  const memory = bytesToShrink(memoryAmount);
  const storage = bytesToShrink(storageAmount);
  const { theme } = useTheme();
  const badgeClasses = cn("h-auto rounded-3xl py-0 px-1", {
    ["bg-gray-700"]: theme === "dark",
    ["bg-gray-100"]: theme === "light",
    ["bg-primary text-white"]: color === "primary",
    ["bg-secondary text-initial"]: color === "secondary"
  });
  const specDetailIconClasses = cn({ ["text-2xl"]: size === "large", ["text-xl"]: size === "medium", ["text-sm"]: size === "small" });
  const specDetailClasses = cn("ml-2", { ["text-lg"]: size === "large", ["text-sm"]: size === "medium", ["text-xs"]: size === "small" });

  return (
    <div
      className={cn("grid grid-cols-1 sm:grid-cols-3", {
        ["gap-1"]: gutterSize === "small",
        ["gap-2"]: gutterSize === "medium",
        ["gap-3"]: gutterSize === "large"
      })}
      // sx={{
      //   display: "flex",
      //   alignItems: { xs: "start", sm: "start", md: "center" },
      //   flexDirection: { xs: "column", sm: "column", md: "row" }
      // }}
    >
      <Badge className={badgeClasses} variant="outline">
        <div className="flex items-center py-1">
          <MdSpeed className={specDetailIconClasses} />
          <div className={specDetailClasses}>{roundDecimal(cpuAmount, 2) + " CPU"}</div>
        </div>
      </Badge>

      {gpuAmount > 0 && (
        <Badge
          variant="outline"
          // variant="outlined"
          // // TODO Type
          // color={color as any}
          // classes={{ root: classes.chipRoot }}
          // className={cx({
          //   [classes.defaultColor]: color === "default",
          //   [classes.gutterSmall]: !smallScreen && gutterSize === "small",
          //   [classes.gutterMedium]: !smallScreen && gutterSize === "medium",
          //   [classes.gutterLarge]: !smallScreen && gutterSize === "large"
          // })}
          className={badgeClasses}
        >
          <div className="flex items-center py-1">
            <MdDeveloperBoard className={specDetailIconClasses} />
            <div className={specDetailClasses}>{gpuAmount + " GPU"}</div>
            {gpuModels && gpuModels?.length > 0 && (
              <div style={{ display: "inline", marginLeft: "5px" }}>
                {gpuModels.map((gpu, i) => (
                  <Badge key={`${gpu.vendor}-${gpu.model}`} className={cn({ ["mr-1"]: i < gpuModels.length })} color="default">
                    {`${gpu.vendor}-${gpu.model}`}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </Badge>
      )}

      <Badge variant="outline" className={badgeClasses}>
        <div className="flex items-center py-1">
          <MdMemory className={specDetailIconClasses} />
          <div className={specDetailClasses}>{`${roundDecimal(memory.value, 2)} ${memory.unit}`}</div>
        </div>
      </Badge>

      <Badge variant="outline" className={badgeClasses}>
        <div className="flex items-center py-1">
          <MdStorage className={specDetailIconClasses} />
          <div className={specDetailClasses}>{`${roundDecimal(storage.value, 2)} ${storage.unit}`}</div>
        </div>
      </Badge>
    </div>
  );
}
