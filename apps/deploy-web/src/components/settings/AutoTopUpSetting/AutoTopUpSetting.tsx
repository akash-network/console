import type { FC } from "react";
import React, { useCallback, useEffect, useMemo } from "react";
import type { SubmitHandler } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import { Button, Form, FormField, FormInput } from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import addYears from "date-fns/addYears";
import format from "date-fns/format";
import { z } from "zod";

import { aktToUakt, uaktToAKT } from "@src/utils/priceUtils";

const positiveNumberSchema = z.coerce.number().min(0, {
  message: "Amount must be greater or equal to 0."
});

const formSchema = z
  .object({
    uaktFeeLimit: positiveNumberSchema,
    usdcFeeLimit: positiveNumberSchema,
    uaktDeploymentLimit: positiveNumberSchema,
    usdcDeploymentLimit: positiveNumberSchema,
    expiration: z.string().min(1, "Expiration is required.")
  })
  .refine(
    data => {
      if (data.usdcDeploymentLimit > 0) {
        return data.usdcFeeLimit > 0;
      }
      return true;
    },
    {
      message: "Must be greater than 0 if `USDC Deployments Limit` is greater than 0",
      path: ["usdcFeeLimit"]
    }
  )
  .refine(
    data => {
      if (data.usdcFeeLimit > 0) {
        return data.usdcDeploymentLimit > 0;
      }
      return true;
    },
    {
      message: "Must be greater than 0 if `USDC Fees Limit` is greater than 0",
      path: ["usdcDeploymentLimit"]
    }
  )
  .refine(
    data => {
      if (data.uaktDeploymentLimit > 0) {
        return data.uaktFeeLimit > 0;
      }
      return true;
    },
    {
      message: "Must be greater than 0 if `AKT Deployments Limit` is greater than 0",
      path: ["uaktFeeLimit"]
    }
  )
  .refine(
    data => {
      if (data.uaktFeeLimit > 0) {
        return data.uaktDeploymentLimit > 0;
      }
      return true;
    },
    {
      message: "Must be greater than 0 if `AKT Fees Limit` is greater than 0",
      path: ["uaktDeploymentLimit"]
    }
  );

type FormValues = z.infer<typeof formSchema>;

type LimitFields = keyof Omit<FormValues, "expiration">;

type AutoTopUpSubmitHandler = (action: "revoke-all" | "update", next: FormValues) => Promise<void>;

export interface AutoTopUpSettingProps extends Partial<Record<LimitFields, number>> {
  onSubmit: AutoTopUpSubmitHandler;
  expiration?: Date;
}

const fields: LimitFields[] = ["uaktFeeLimit", "usdcFeeLimit", "uaktDeploymentLimit", "usdcDeploymentLimit"];

export const AutoTopUpSetting: FC<AutoTopUpSettingProps> = ({ onSubmit, expiration, ...props }) => {
  const hasAny = useMemo(() => fields.some(field => props[field]), [props]);

  const defaultLimitValues = useMemo(() => {
    return fields.reduce(
      (acc, field) => {
        acc[field] = uaktToAKT(props[field] || 0);
        return acc;
      },
      {} as Record<LimitFields, number>
    );
  }, [props]);

  const form = useForm<z.infer<typeof formSchema>>({
    defaultValues: {
      ...defaultLimitValues,
      expiration: format(expiration || addYears(new Date(), 1), "yyyy-MM-dd'T'HH:mm")
    },
    resolver: zodResolver(formSchema)
  });
  const { handleSubmit, control, setValue, reset } = form;

  useEffect(() => {
    setValue("uaktFeeLimit", uaktToAKT(props.uaktFeeLimit || 0));
  }, [props.uaktFeeLimit]);

  useEffect(() => {
    setValue("usdcFeeLimit", uaktToAKT(props.usdcFeeLimit || 0));
  }, [props.usdcFeeLimit]);

  useEffect(() => {
    setValue("uaktDeploymentLimit", uaktToAKT(props.uaktDeploymentLimit || 0));
  }, [props.uaktDeploymentLimit]);

  useEffect(() => {
    setValue("usdcDeploymentLimit", uaktToAKT(props.usdcDeploymentLimit || 0));
  }, [props.usdcDeploymentLimit]);

  useEffect(() => {
    if (expiration) {
      setValue("expiration", format(expiration || addYears(new Date(), 1), "yyyy-MM-dd'T'HH:mm"));
    }
  }, [expiration]);

  const execSubmitterRoleAction: SubmitHandler<FormValues> = useCallback(
    async (next, event) => {
      const nativeEvent = (event as React.BaseSyntheticEvent<SubmitEvent> | undefined)?.nativeEvent;
      const role = nativeEvent?.submitter?.getAttribute("data-role");
      await onSubmit(role as "revoke-all" | "update", convertToUakt(next));
      reset(next);
    },
    [onSubmit, reset]
  );

  return (
    <div>
      <Form {...form}>
        <form onSubmit={handleSubmit(execSubmitterRoleAction)} noValidate>
          <h5 className="space-y-1.5">Deployments billed in AKT</h5>
          <div className="flex">
            <div className="flex-1">
              <FormField
                control={control}
                name="uaktDeploymentLimit"
                render={({ field, fieldState }) => {
                  return <FormInput {...field} dirty={fieldState.isDirty} type="number" label="Deployments Limit" min={0} step={0.000001} />;
                }}
              />
            </div>

            <div className="ml-3 flex-1">
              <FormField
                control={control}
                name="uaktFeeLimit"
                render={({ field, fieldState }) => {
                  return <FormInput {...field} dirty={fieldState.isDirty} type="number" label="Fees Limit, AKT" min={0} step={0.000001} />;
                }}
              />
            </div>
          </div>

          <h5 className="space-y-1.5 pt-4">Deployments billed in USDC</h5>
          <div className="flex">
            <div className="flex-1">
              <FormField
                control={control}
                name="usdcDeploymentLimit"
                render={({ field, fieldState }) => {
                  return <FormInput {...field} dirty={fieldState.isDirty} type="number" label="Deployments Limit" min={0} step={0.000001} />;
                }}
              />
            </div>

            <div className="ml-3 flex-1">
              <FormField
                control={control}
                name="usdcFeeLimit"
                render={({ field, fieldState }) => {
                  return <FormInput {...field} dirty={fieldState.isDirty} type="number" label="Fees Limit, AKT" min={0} step={0.000001} />;
                }}
              />
            </div>
          </div>

          <div className="my-4 w-full">
            <Controller
              control={control}
              name="expiration"
              render={({ field, fieldState }) => {
                return <FormInput {...field} dirty={fieldState.isDirty} type="datetime-local" label="Expiration" />;
              }}
            />
          </div>

          <Button variant="default" size="sm" className="mr-2" data-role="update" disabled={!form.formState.isDirty}>
            {hasAny ? "Update" : "Enable"}
          </Button>

          {hasAny && (
            <Button variant="default" size="sm" data-role="revoke-all">
              Disable
            </Button>
          )}
        </form>
      </Form>
    </div>
  );
};

function convertToUakt({ ...values }: FormValues) {
  return fields.reduce((acc, field) => {
    acc[field] = aktToUakt(values[field]);
    return acc;
  }, values);
}
