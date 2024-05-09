"use client";
import { bytesToShrink } from "@src/utils/unitUtils";
import { roundDecimal } from "@src/utils/mathHelpers";
import { cn } from "@src/utils/styleUtils";
import { Badge } from "../ui/badge";
import { MdDeveloperBoard, MdMemory, MdSpeed, MdStorage } from "react-icons/md";

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
  gpuAmount?: number;
  gpuModels?: { vendor: string; model: string }[] | null | undefined;
  color?: string;
  size?: "small" | "medium" | "large";
  gutterSize?: "small" | "medium" | "large";
}>) {
  const memory = bytesToShrink(memoryAmount);
  const storage = bytesToShrink(storageAmount);
  const badgeClasses = cn("h-auto rounded-3xl py-0 px-2", {
    ["bg-primary text-white"]: color === "primary",
    ["bg-secondary text-initial dark:bg-neutral-800"]: color === "secondary"
  });
  const specDetailIconClasses = cn({ ["text-2xl"]: size === "large", ["text-xl"]: size === "medium", ["text-sm"]: size === "small" });
  const specDetailClasses = cn("ml-2", { ["text-lg"]: size === "large", ["text-sm"]: size === "medium", ["text-xs"]: size === "small" });

  return (
    <div
      className={cn("flex items-center", {
        ["space-x-1"]: gutterSize === "small",
        ["space-x-2"]: gutterSize === "medium",
        ["space-x-3"]: gutterSize === "large"
      })}
    >
      <Badge className={badgeClasses} variant="outline">
        <div className="flex items-center py-1">
          <MdSpeed className={specDetailIconClasses} />
          <div className={specDetailClasses}>{roundDecimal(cpuAmount, 2) + " CPU"}</div>
        </div>
      </Badge>

      {gpuAmount > 0 && (
        <Badge variant="outline" className={badgeClasses}>
          <div className="flex items-center py-1">
            <MdDeveloperBoard className={specDetailIconClasses} />
            <div className={specDetailClasses}>{gpuAmount + " GPU"}</div>
            {gpuModels && gpuModels?.length > 0 && (
              <div className="ml-2 inline-flex items-center space-x-2">
                {gpuModels.map((gpu, i) => (
                  <Badge key={`${gpu.vendor}-${gpu.model}`} className="py-0 text-xs" color="default">
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
