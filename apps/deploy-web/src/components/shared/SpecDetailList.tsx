"use client";
import { MdDeveloperBoard, MdMemory, MdSpeed, MdStorage } from "react-icons/md";
import LinearProgress from "@mui/material/LinearProgress";

import { roundDecimal } from "@src/utils/mathHelpers";
import { cn } from "@src/utils/styleUtils";
import { bytesToShrink } from "@src/utils/unitUtils";

export function SpecDetailList({ cpuAmount, memoryAmount, storageAmount, gpuAmount = 0, isActive }) {
  const memory = bytesToShrink(memoryAmount);
  const storage = bytesToShrink(storageAmount);

  const activeColorClasses = "";
  const serverRowClasses = " w-[110px] text-center flex items-center py-[2px] px-[4px] space-x-2";
  const defaultColorClasses = "text-muted-foreground border-muted-foreground/20";
  const activeIconClasses = "opacity-100 text-primary";
  const specIconClasses = "text-lg flex-shrink-0";
  const specDetailClasses = "flex-grow text-left text-xs leading-3 whitespace-nowrap";

  return (
    <div className="inline-flex flex-col flex-nowrap items-center divide-y overflow-hidden rounded-md border bg-popover p-0">
      {isActive && <LinearProgress className="h-[2px] w-full opacity-30" />}

      <div className={cn(serverRowClasses, defaultColorClasses, { [activeColorClasses]: isActive })}>
        <MdSpeed className={cn(specIconClasses, defaultColorClasses, { [activeColorClasses]: isActive, [activeIconClasses]: isActive })} />
        <div className={cn(specDetailClasses, defaultColorClasses, { [activeColorClasses]: isActive })}>{roundDecimal(cpuAmount, 2) + " cpu"}</div>
      </div>

      {gpuAmount > 0 && (
        <div className={cn(serverRowClasses, defaultColorClasses, { [activeColorClasses]: isActive })}>
          <MdDeveloperBoard className={cn(specIconClasses, defaultColorClasses, { [activeColorClasses]: isActive, [activeIconClasses]: isActive })} />
          <div className={cn(specDetailClasses, defaultColorClasses, { [activeColorClasses]: isActive })}>{gpuAmount + " gpu"}</div>
        </div>
      )}

      <div className={cn(serverRowClasses, defaultColorClasses, { [activeColorClasses]: isActive })}>
        <MdMemory className={cn(specIconClasses, defaultColorClasses, { [activeColorClasses]: isActive, [activeIconClasses]: isActive })} />
        <div className={cn(specDetailClasses, defaultColorClasses, { [activeColorClasses]: isActive })}>{`${roundDecimal(memory.value, 2)} ${
          memory.unit
        }`}</div>
      </div>

      <div className={cn(serverRowClasses, defaultColorClasses, { [activeColorClasses]: isActive })}>
        <MdStorage className={cn(specIconClasses, defaultColorClasses, { [activeColorClasses]: isActive, [activeIconClasses]: isActive })} />
        <div className={cn(specDetailClasses, defaultColorClasses, { [activeColorClasses]: isActive })}>{`${roundDecimal(storage.value, 2)} ${
          storage.unit
        }`}</div>
      </div>
    </div>
  );
}
