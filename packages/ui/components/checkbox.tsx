"use client";
import * as React from "react";
import { useCallback } from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";

import { cn } from "../utils";

interface CheckboxTouchTargetProps {
  expandedTouchTarget?: boolean;
}

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> & CheckboxTouchTargetProps
>(({ className, onClick, expandedTouchTarget = false, ...props }, ref) => {
  const checkboxRef = React.useRef<HTMLButtonElement>(null);
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  React.useImperativeHandle(ref, () => checkboxRef.current!);

  const triggerCheckboxClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === wrapperRef.current) {
      e.preventDefault();
      e.stopPropagation();
      checkboxRef.current?.click();
    }
  }, []);

  return (
    <div
      ref={wrapperRef}
      className={cn("inline-flex", expandedTouchTarget && "hover:bg-accent cursor-pointer rounded-full p-3")}
      onClick={expandedTouchTarget ? triggerCheckboxClick : undefined}
    >
      <CheckboxPrimitive.Root
        ref={checkboxRef}
        className={cn(
          "border-primary ring-offset-background data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground focus-visible:ring-ring peer h-4 w-4 shrink-0 rounded-[4px] border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        onClick={onClick}
        {...props}
      >
        <CheckboxPrimitive.Indicator className={cn("flex items-center justify-center text-current")}>
          <Check className="h-4 w-4" />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
    </div>
  );
});
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

const CheckboxWithLabel = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> &
    CheckboxTouchTargetProps & {
      label: string;
      labelPosition?: "left" | "right";
      labelClassName?: string;
    }
>(({ className, label, labelPosition = "right", labelClassName = "", ...props }, ref) => {
  const id = React.useId();
  const _label = (
    <label htmlFor={id} className={cn("cursor-pointer text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", labelClassName)}>
      {label}
    </label>
  );

  return (
    <div className="flex cursor-pointer items-center space-x-2">
      {labelPosition === "left" && _label}
      <Checkbox {...props} id={id} ref={ref} />
      {labelPosition === "right" && _label}
    </div>
  );
});
CheckboxWithLabel.displayName = "CheckboxWithLabel";

export { Checkbox, CheckboxWithLabel };
