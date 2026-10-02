"use client";
import type { FC } from "react";
import { useId } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { extractApiErrorMessage, isApiError } from "@akashnetwork/openapi-sdk";
import {
  Alert,
  Button,
  Checkbox,
  DialogV2,
  DialogV2Body,
  DialogV2Content,
  DialogV2Description,
  DialogV2Footer,
  DialogV2Header,
  DialogV2Title,
  Field,
  FieldContent,
  FieldError,
  FieldLabel,
  Input,
  QuantityStepper,
  Snackbar,
  Textarea,
  ToggleGroup,
  ToggleGroupItem
} from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import { MessagesSquareIcon, SendIcon } from "lucide-react";
import { useSnackbar } from "notistack";

import { useServices } from "@src/context/ServicesProvider";
import { useUser } from "@src/hooks/useUser";
import type { HardwareRequestCategory, HardwareRequestConfiguration, HardwareRequestFormValues } from "./hardwareRequestForm";
import {
  HARDWARE_REQUEST_CATEGORIES,
  hardwareRequestFormSchema,
  MAX_DETAILS_LENGTH,
  MAX_GPU_MODEL_LENGTH,
  MAX_GPU_QUANTITY,
  MAX_REGION_LENGTH,
  toCreateHardwareRequestData
} from "./hardwareRequestForm";

export const DEPENDENCIES = { useUser, useSnackbar };

const CATEGORIES_WITH_GPU_FIELDS: HardwareRequestCategory[] = ["gpu_model", "capacity"];

function isRequestLimitError(error: unknown): boolean {
  return isApiError(error) && error.status === 429;
}

/** Hitting the request limit is the user's state rather than a fault, so it is shown in the dialog instead of being reported. */
const SKIP_REPORTING_REQUEST_LIMIT = { skipErrorReporting: isRequestLimitError };

type Props = {
  initialGpuModel: string;
  initialCategory?: HardwareRequestCategory;
  configuration: HardwareRequestConfiguration;
  onClose: () => void;
  dependencies?: typeof DEPENDENCIES;
};

export const HardwareRequestDialog: FC<Props> = ({
  initialGpuModel,
  initialCategory = "gpu_model",
  configuration,
  onClose,
  dependencies: d = DEPENDENCIES
}) => {
  const { api, publicConfig } = useServices();
  const { user } = d.useUser();
  const { enqueueSnackbar } = d.useSnackbar();
  const createHardwareRequest = api.v1.createHardwareRequest.useMutation({ meta: SKIP_REPORTING_REQUEST_LIMIT });
  const formId = useId();
  const fieldIds = { category: useId(), gpuModel: useId(), region: useId(), details: useId(), email: useId(), includeConfiguration: useId() };

  const { control, register, handleSubmit, formState } = useForm<HardwareRequestFormValues>({
    mode: "onChange",
    resolver: zodResolver(hardwareRequestFormSchema),
    defaultValues: {
      category: initialCategory,
      gpuModel: initialGpuModel,
      quantity: 1,
      region: "",
      details: "",
      email: user?.email ?? "",
      includeConfiguration: true
    }
  });
  const category = useWatch({ control, name: "category" });
  const { errors } = formState;
  const limitMessage = isRequestLimitError(createHardwareRequest.error) ? extractApiErrorMessage(createHardwareRequest.error) : null;

  function sendRequest(values: HardwareRequestFormValues) {
    createHardwareRequest.mutate(
      { data: toCreateHardwareRequestData(values, configuration) },
      {
        onSuccess: function confirmSentAndClose() {
          enqueueSnackbar(<Snackbar title="Request sent" subTitle="We'll follow up by email." iconVariant="success" />, { variant: "success" });
          onClose();
        },
        onError: function reportSendFailure(error) {
          if (isRequestLimitError(error)) return;
          enqueueSnackbar(<Snackbar title="Couldn't send your request" subTitle="Please try again, or ask us on Discord." iconVariant="error" />, {
            variant: "error"
          });
        }
      }
    );
  }

  return (
    <DialogV2 open onOpenChange={isOpen => (!isOpen ? onClose() : undefined)}>
      <DialogV2Content className="max-w-xl">
        <DialogV2Header>
          <DialogV2Title>Tell us what you need</DialogV2Title>
          <DialogV2Description>
            Can&apos;t find the hardware or region you&apos;re looking for? Send us the details and we&apos;ll follow up by email.
          </DialogV2Description>
        </DialogV2Header>

        <DialogV2Body>
          <form id={formId} onSubmit={handleSubmit(sendRequest)} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-2">
              <span id={fieldIds.category} className="text-sm font-medium">
                What are you looking for?
              </span>
              <Controller
                control={control}
                name="category"
                render={({ field }) => (
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    aria-labelledby={fieldIds.category}
                    value={field.value}
                    onValueChange={value => value && field.onChange(value)}
                    className="flex flex-wrap justify-start gap-2"
                  >
                    {HARDWARE_REQUEST_CATEGORIES.map(option => (
                      <ToggleGroupItem
                        key={option.value}
                        value={option.value}
                        className="h-9 rounded-full px-4 font-normal data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:text-background data-[state=on]:hover:bg-foreground data-[state=on]:hover:text-background"
                      >
                        {option.label}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                )}
              />
            </div>

            {CATEGORIES_WITH_GPU_FIELDS.includes(category) && (
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <Field className="gap-2">
                  <FieldLabel htmlFor={fieldIds.gpuModel}>{category === "capacity" ? "GPU model (optional)" : "GPU model"}</FieldLabel>
                  <FieldContent>
                    <Input
                      id={fieldIds.gpuModel}
                      placeholder="e.g. B200, MI300X"
                      maxLength={MAX_GPU_MODEL_LENGTH}
                      aria-invalid={!!errors.gpuModel}
                      {...register("gpuModel")}
                    />
                    <FieldError errors={[errors.gpuModel]} />
                  </FieldContent>
                </Field>
                <Field className="gap-2">
                  <FieldLabel>Quantity</FieldLabel>
                  <FieldContent>
                    <Controller
                      control={control}
                      name="quantity"
                      render={({ field }) => <QuantityStepper label="Quantity" value={field.value} min={1} max={MAX_GPU_QUANTITY} onChange={field.onChange} />}
                    />
                  </FieldContent>
                </Field>
              </div>
            )}

            {category === "region" && (
              <Field className="gap-2">
                <FieldLabel htmlFor={fieldIds.region}>Region</FieldLabel>
                <FieldContent>
                  <Input
                    id={fieldIds.region}
                    placeholder="e.g. Frankfurt, US East"
                    maxLength={MAX_REGION_LENGTH}
                    aria-invalid={!!errors.region}
                    {...register("region")}
                  />
                  <FieldError errors={[errors.region]} />
                </FieldContent>
              </Field>
            )}

            <Field className="gap-2">
              <FieldLabel htmlFor={fieldIds.details}>Details</FieldLabel>
              <FieldContent>
                <Textarea
                  id={fieldIds.details}
                  rows={4}
                  placeholder="Workload, timeline, how long you'd rent it..."
                  maxLength={MAX_DETAILS_LENGTH}
                  aria-invalid={!!errors.details}
                  {...register("details")}
                />
                <FieldError errors={[errors.details]} />
              </FieldContent>
            </Field>

            <div className="flex items-start gap-3 rounded-lg border bg-muted p-4">
              <Controller
                control={control}
                name="includeConfiguration"
                render={({ field }) => (
                  <Checkbox
                    id={fieldIds.includeConfiguration}
                    checked={field.value}
                    onCheckedChange={checked => field.onChange(checked === true)}
                    className="mt-0.5"
                  />
                )}
              />
              <div className="flex min-w-0 flex-col gap-1">
                <label htmlFor={fieldIds.includeConfiguration} className="cursor-pointer text-sm font-medium">
                  Include my current configuration
                </label>
                <span className="break-words font-mono text-xs text-muted-foreground">{configuration.summary}</span>
              </div>
            </div>

            <Field className="gap-2">
              <FieldLabel htmlFor={fieldIds.email}>Email</FieldLabel>
              <FieldContent>
                <Input id={fieldIds.email} type="email" autoComplete="email" aria-invalid={!!errors.email} {...register("email")} />
                <FieldError errors={[errors.email]} />
              </FieldContent>
            </Field>

            {limitMessage && <Alert variant="destructive">{limitMessage}</Alert>}
          </form>
        </DialogV2Body>

        <DialogV2Footer className="sm:justify-between">
          <a
            href={publicConfig.NEXT_PUBLIC_CONTACT_SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 self-center text-sm text-muted-foreground hover:text-foreground"
          >
            <MessagesSquareIcon className="h-4 w-4" aria-hidden="true" />
            Or ask on Discord
          </a>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" form={formId} disabled={!formState.isValid || createHardwareRequest.isPending} className="gap-2">
              <SendIcon className="h-4 w-4" aria-hidden="true" />
              Send request
            </Button>
          </div>
        </DialogV2Footer>
      </DialogV2Content>
    </DialogV2>
  );
};
