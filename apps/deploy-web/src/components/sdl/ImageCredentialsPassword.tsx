"use client";
import { useCallback, useMemo, useState } from "react";
import type { Control } from "react-hook-form";
import { buttonVariants, FormField, FormItem, FormMessage, Input } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { EyeClosed, EyeSolid } from "iconoir-react";

import type { SdlBuilderFormValuesType } from "@src/types";

type Props = {
  serviceIndex: number;
  control: Control<SdlBuilderFormValuesType, any>;
  label: string;
};

export const ImageCredentialsPassword: React.FunctionComponent<Props> = ({ serviceIndex, control, label }) => {
  const [type, setType] = useState("password");
  const toggleType = useCallback(() => {
    setType(type === "password" ? "text" : "password");
  }, [type]);
  const isClosed = useMemo(() => type === "password", [type]);

  return (
    <FormField
      control={control}
      name={`services.${serviceIndex}.credentials.password`}
      render={({ field, fieldState }) => (
        <FormItem className="w-full">
          <Input
            type={type}
            label={<div className="inline-flex items-center">{label}</div>}
            value={field.value}
            error={!!fieldState.error}
            onChange={event => field.onChange(event.target.value || "")}
            endIcon={
              <span
                className={cn(
                  buttonVariants({
                    variant: "text",
                    size: "icon"
                  }),
                  "cursor-pointer"
                )}
                onClick={toggleType}
              >
                {isClosed ? <EyeClosed /> : <EyeSolid />}
              </span>
            }
            data-testid="credentials-password-input"
          />

          <FormMessage />
        </FormItem>
      )}
    />
  );
};
