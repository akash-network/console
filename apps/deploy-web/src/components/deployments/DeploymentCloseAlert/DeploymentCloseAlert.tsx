"use client";
import type { FC } from "react";
import { useId } from "react";
import { useFormContext } from "react-hook-form";
import { Checkbox, FormField, Label } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";

export const DeploymentCloseAlert: FC<{ disabled?: boolean }> = ({ disabled }) => {
  const { control } = useFormContext();
  const checkboxId = useId();
  const descriptionId = useId();

  return (
    <FormField
      control={control}
      name="deploymentClosed.enabled"
      render={({ field }) => (
        <div className="flex items-start gap-3">
          <div className="pt-px">
            <Checkbox
              id={checkboxId}
              aria-describedby={descriptionId}
              className="h-[18px] w-[18px]"
              checked={field.value}
              disabled={disabled}
              onCheckedChange={value => field.onChange(value === true)}
            />
          </div>
          <div className="space-y-0.5">
            <Label htmlFor={checkboxId} className={cn("block text-sm leading-5", disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer")}>
              Deployment Closed
            </Label>
            <p id={descriptionId} className="text-[13px] leading-snug text-muted-foreground">
              When a deployment is closed for any reason.
            </p>
          </div>
        </div>
      )}
    />
  );
};
