"use client";

import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "../utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> & {
    size?: "sm" | "default";
  }
>(({ className, size = "default", ...props }, ref) => (
  <SwitchPrimitives.Root
    data-size={size}
    className={cn(
      "group/switch aria-[checked=false]:bg-input aria-[checked=true]:bg-primary focus-visible:ring-ring focus-visible:ring-offset-background peer inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-6 data-[size=sm]:h-4 data-[size=default]:w-11 data-[size=sm]:w-7",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "bg-background pointer-events-none block rounded-full shadow-lg ring-0 transition-transform data-[state=unchecked]:translate-x-0 group-data-[size=default]/switch:h-5 group-data-[size=sm]/switch:h-3 group-data-[size=default]/switch:w-5 group-data-[size=sm]/switch:w-3 group-data-[size=default]/switch:data-[state=checked]:translate-x-5 group-data-[size=sm]/switch:data-[state=checked]:translate-x-3"
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

const SwitchWithLabel = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> & {
    label: string;
    labelPosition?: "left" | "right";
  }
>(({ className, label, labelPosition = "right", ...props }, ref) => {
  const id = React.useId();
  const _label = (
    <label htmlFor={id} className="cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
      {label}
    </label>
  );

  return (
    <div className={cn("flex cursor-pointer items-center space-x-2", className)}>
      {labelPosition === "left" && _label}
      <Switch {...props} id={id} ref={ref} />
      {labelPosition === "right" && _label}
    </div>
  );
});
SwitchWithLabel.displayName = "SwitchWithLabel";

export { Switch, SwitchWithLabel };
