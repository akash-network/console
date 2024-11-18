"use client";
import { Control } from "react-hook-form";
import {
  buttonVariants,
  CustomTooltip,
  FormField,
  FormItem,
  FormMessage,
  Input,
} from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { InfoCircle, OpenInWindow } from "iconoir-react";
import Link from "next/link";

import { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { ImageRegistryLogo } from "./ImageRegistryLogo";

type Props = {
  serviceIndex: number;
  control: Control<SdlBuilderFormValuesType, any>;
  credentials?: ServiceType['credentials'];
};

export const ImageInput: React.FunctionComponent<Props> = ({
  serviceIndex,
  control,
  credentials
}) => {
  return (
    <FormField
      control={control}
      name={`services.${serviceIndex}.image`}
      render={({ field, fieldState }) => (
        <FormItem className="w-full">
          <Input
            type="text"
            label={
              <div className="inline-flex items-center">
                Docker Image / OS
                <CustomTooltip
                  title={
                    <>
                      Docker image of the container.
                      <br />
                      <br />
                      Best practices: avoid using :latest image tags as Akash Providers heavily cache images.
                    </>
                  }
                >
                  <InfoCircle className="ml-2 text-xs text-muted-foreground" />
                </CustomTooltip>
              </div>
            }
            placeholder="Example: mydockerimage:1.01"
            value={field.value}
            error={!!fieldState.error}
            onChange={event => field.onChange((event.target.value || "").toLowerCase())}
            startIconClassName="pl-2"
            startIcon={<ImageRegistryLogo host={credentials?.host} />}
            endIcon={
              <Link
                href={`https://hub.docker.com/search?q=${field.value.split(":")[0]}&type=image`}
                className={cn(
                  buttonVariants({
                    variant: "text",
                    size: "icon"
                  }),
                  "text-muted-foreground"
                )}
                target="_blank"
              >
                <OpenInWindow />
              </Link>
            }
            data-testid="image-name-input"
          />
          <FormMessage />
        </FormItem>
      )}
    />
  );
};
