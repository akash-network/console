"use client";
import { HTMLInputTypeAttribute, useEffect, useRef, useState } from "react";
import { Control, Controller, FieldPath, RegisterOptions, useFieldArray, useForm } from "react-hook-form";
import { Bin, InfoCircle } from "iconoir-react";
import { nanoid } from "nanoid";

import { FormPaper } from "@src/components/sdl/FormPaper";
import { CustomTooltip } from "@src/components/shared/CustomTooltip";
import { Alert } from "@src/components/ui/alert";
import { Button } from "@src/components/ui/button";
import { CheckboxWithLabel } from "@src/components/ui/checkbox";
import { FormItem } from "@src/components/ui/form";
import { InputWithIcon } from "@src/components/ui/input";
import { Label } from "@src/components/ui/label";
import MultipleSelector, { Option } from "@src/components/ui/multiple-selector";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@src/components/ui/select";
import { useWallet } from "@src/context/WalletProvider";
import { ApiProviderDetail } from "@src/types/provider";
import { ProviderAttributeSchemaDetailValue, ProviderAttributesFormValues, ProviderAttributesSchema } from "@src/types/providerAttributes";
import { defaultProviderAttributes } from "@src/utils/providerAttributes/data";
import { getUnknownAttributes, mapFormValuesToAttributes } from "@src/utils/providerAttributes/helpers";
import { cn } from "@src/utils/styleUtils";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";

type Props = {
  provider: Partial<ApiProviderDetail>;
  providerAttributesSchema: ProviderAttributesSchema;
};

export const EditProviderForm: React.FunctionComponent<Props> = ({ provider, providerAttributesSchema }) => {
  const [isInit, setIsInit] = useState(false);
  const [error, setError] = useState(null);
  const formRef = useRef<HTMLFormElement>(null);
  const { signAndBroadcastTx } = useWallet();
  const { handleSubmit, control, watch, setValue, formState } = useForm<ProviderAttributesFormValues>({
    defaultValues: {
      ...defaultProviderAttributes
    }
  });
  const {
    fields: unknownAttributes,
    remove: removeUnkownAttribute,
    append: appendUnkownAttribute
  } = useFieldArray({
    control,
    name: "unknown-attributes",
    keyName: "id"
  });
  const { "feat-persistent-storage": featPersistentStorage, "workload-support-chia": workloadSupportChia, "unknown-attributes": _unknownAttributes } = watch();

  console.log(formState);

  useEffect(() => {
    const getProviderAttributeTextValue = (key: string) => {
      return provider?.attributes?.find(x => x.key === key)?.value || "";
    };

    const getAttributeOptionValue = (key: string) => {
      const _key = providerAttributesSchema[key].key as string;
      const possibleValues = providerAttributesSchema[key].values as ProviderAttributeSchemaDetailValue[];
      const attributeValue = provider?.attributes?.find(x => x.key === _key);
      return possibleValues.find(x => x.key === attributeValue?.value);
    };

    const getAttributeMultipleOptionValue = (key: string) => {
      const possibleValues = providerAttributesSchema[key].values as ProviderAttributeSchemaDetailValue[];

      return possibleValues.filter(x => provider?.attributes?.some(y => x.key === y.key));
    };

    const getProviderAttributeValue = (key: keyof ProviderAttributesSchema) => {
      const attribute = providerAttributesSchema[key];

      switch (attribute.type) {
        case "string":
          return getProviderAttributeTextValue(key);
        case "number":
          return parseInt(getProviderAttributeTextValue(key)) || "";
        case "boolean":
          return getProviderAttributeTextValue(key) === "true";
        case "option":
          return getAttributeOptionValue(key);
        case "multiple-option":
          return getAttributeMultipleOptionValue(key);
        default:
          return "";
      }
    };

    if (providerAttributesSchema && !isInit) {
      const unknownAttributes = getUnknownAttributes(provider?.attributes || [], providerAttributesSchema);

      setValue("host-uri", provider?.hostUri || "");
      setValue("host", getProviderAttributeValue("host") as string);
      setValue("website", getProviderAttributeValue("website") as string);
      setValue("email", getProviderAttributeValue("email") as string);
      setValue("organization", getProviderAttributeValue("organization") as string);
      setValue("status-page", getProviderAttributeValue("status-page") as string);
      setValue("location-region", getProviderAttributeValue("location-region") as string);
      setValue("country", getProviderAttributeValue("country") as string);
      setValue("city", getProviderAttributeValue("city") as string);
      setValue("timezone", getProviderAttributeValue("timezone") as string);
      setValue("location-type", getProviderAttributeValue("location-type") as string);
      setValue("hosting-provider", getProviderAttributeValue("hosting-provider") as string);
      setValue("hardware-cpu", getProviderAttributeValue("hardware-cpu") as string);
      setValue("hardware-cpu-arch", getProviderAttributeValue("hardware-cpu-arch") as string);
      setValue("hardware-gpu", getProviderAttributeValue("hardware-gpu") as string);
      setValue("hardware-gpu-model", getProviderAttributeValue("hardware-gpu-model") as ProviderAttributeSchemaDetailValue[]);
      setValue("hardware-disk", getProviderAttributeValue("hardware-disk") as ProviderAttributeSchemaDetailValue[]);
      setValue("feat-persistent-storage", getProviderAttributeValue("feat-persistent-storage") as boolean);
      setValue("feat-persistent-storage-type", getProviderAttributeValue("feat-persistent-storage-type") as ProviderAttributeSchemaDetailValue[]);
      setValue("hardware-memory", getProviderAttributeValue("hardware-memory") as string);
      setValue("network-provider", getProviderAttributeValue("network-provider") as string);
      setValue("network-speed-down", getProviderAttributeValue("network-speed-down") as number);
      setValue("network-speed-up", getProviderAttributeValue("network-speed-up") as number);
      setValue("tier", getProviderAttributeValue("tier") as string);
      setValue("feat-endpoint-custom-domain", getProviderAttributeValue("feat-endpoint-custom-domain") as boolean);
      setValue("workload-support-chia", getProviderAttributeValue("workload-support-chia") as boolean);
      setValue("workload-support-chia-capabilities", getProviderAttributeValue("workload-support-chia-capabilities") as ProviderAttributeSchemaDetailValue[]);
      setValue("feat-endpoint-ip", getProviderAttributeValue("feat-endpoint-ip") as boolean);

      setValue("unknown-attributes", unknownAttributes);

      setIsInit(true);
    }
  }, [providerAttributesSchema, isInit]);

  const onSubmit = async (data: ProviderAttributesFormValues) => {
    setError(null);

    try {
      const attributes = mapFormValuesToAttributes(data, providerAttributesSchema);
      console.log(data, attributes);

      const message = TransactionMessageData.getUpdateProviderMsg(provider?.owner || "", data["host-uri"], attributes, {
        email: data.email,
        website: data.website
      });
      await signAndBroadcastTx([message]);
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} ref={formRef} autoComplete="off">
      <FormPaper className="mb-4">
        <p className="text-primary mb-8 text-lg">General info</p>

        <Controller
          control={control}
          name="host-uri"
          rules={{
            required: "Host URI is required"
          }}
          render={({ field, fieldState }) => (
            <InputWithIcon
              type="text"
              // variant="outlined"
              label="Host URI"
              color="secondary"
              tabIndex={0}
              error={fieldState.error?.message}
              // helperText={fieldState.error?.message}
              // fullWidth
              value={field.value}
              className="mb-4"
              // size="small"
              onChange={event => field.onChange(event.target.value || "")}
              endIcon={
                <CustomTooltip title="Host URI is the URI of the host that is running the provider. It is used to identify the provider.">
                  <InfoCircle className="text-muted-foreground ml-2 text-xs" />
                </CustomTooltip>
              }
            />
          )}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/** LEFT COLUMN */}
          <div>
            <ProviderTextField
              control={control}
              className="mb-4"
              label="Host"
              name="host"
              providerAttributesSchema={providerAttributesSchema}
              requiredMessage="Host is required."
            />

            <ProviderTextField
              control={control}
              className="mb-4"
              label="Website"
              name="website"
              providerAttributesSchema={providerAttributesSchema}
              requiredMessage="Website is required."
            />

            <ProviderTextField
              control={control}
              className="mb-4"
              label="Status Page"
              name="status-page"
              providerAttributesSchema={providerAttributesSchema}
              requiredMessage="Status page is required."
            />

            <ProviderTextField
              control={control}
              className="mb-4"
              label="Country"
              name="country"
              providerAttributesSchema={providerAttributesSchema}
              requiredMessage="Country is required."
              rules={{
                maxLength: { value: 2, message: "Country must be Country ISO 3166 Alpha-2 code." },
                minLength: { value: 2, message: "Country must be Country ISO 3166 Alpha-2 code." }
              }}
              valueModifier={value => value?.toUpperCase()}
            />

            <ProviderSelect
              control={control}
              className="mb-4"
              label="Timezone"
              name="timezone"
              providerAttributesSchema={providerAttributesSchema}
              requiredMessage="Timezone is required."
            />

            <ProviderTextField
              control={control}
              className="mb-4"
              label="Hosting Provider"
              name="hosting-provider"
              providerAttributesSchema={providerAttributesSchema}
              requiredMessage="Hosting provider is required."
            />
          </div>
          {/** RIGHT COLUMN */}
          <div>
            <ProviderTextField
              control={control}
              className="mb-4"
              label="Email"
              name="email"
              type="email"
              providerAttributesSchema={providerAttributesSchema}
              requiredMessage="Email is required."
            />

            <ProviderTextField
              control={control}
              className="mb-4"
              label="Organization"
              name="organization"
              providerAttributesSchema={providerAttributesSchema}
              requiredMessage="Organization is required."
            />

            <ProviderSelect
              control={control}
              className="mb-4"
              label="Location Region"
              name="location-region"
              providerAttributesSchema={providerAttributesSchema}
              requiredMessage="Location Region is required."
            />

            <ProviderTextField
              control={control}
              className="mb-4"
              label="City"
              name="city"
              providerAttributesSchema={providerAttributesSchema}
              requiredMessage="City is required."
              rules={{ maxLength: { value: 3, message: "City must be 3 letter code." }, minLength: { value: 3, message: "City must be 3 letter code." } }}
              valueModifier={value => value?.toUpperCase()}
            />

            <ProviderSelect
              control={control}
              className="mb-4"
              label="Location type"
              name="location-type"
              providerAttributesSchema={providerAttributesSchema}
              requiredMessage="Location type is required."
            />

            <ProviderSelect
              control={control}
              className="mb-4"
              label="Tier"
              name="tier"
              providerAttributesSchema={providerAttributesSchema}
              requiredMessage="Tier is required."
            />
          </div>
        </div>
      </FormPaper>

      <FormPaper className="mb-4">
        <p className="text-primary mb-8 text-lg">Hardware specifications</p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/** LEFT COLUMN */}
          <div>
            <ProviderSelect
              control={control}
              className="mb-4"
              label="GPU"
              name="hardware-gpu"
              providerAttributesSchema={providerAttributesSchema}
              requiredMessage="GPU is required."
            />
            <ProviderSelect
              control={control}
              className="mb-4"
              label="CPU"
              name="hardware-cpu"
              providerAttributesSchema={providerAttributesSchema}
              requiredMessage="CPU is required."
            />

            <ProviderSelect
              control={control}
              className="mb-4"
              label="Memory (RAM)"
              name="hardware-memory"
              providerAttributesSchema={providerAttributesSchema}
              requiredMessage="Memory is required."
            />

            <ProviderCheckbox
              control={control}
              providerAttributesSchema={providerAttributesSchema}
              className="mb-4"
              label="Persistent storage"
              name="feat-persistent-storage"
            />

            <ProviderTextField
              control={control}
              className="mb-4"
              label="Network Speed Download"
              name="network-speed-down"
              providerAttributesSchema={providerAttributesSchema}
              requiredMessage="Network speed download is required."
              type="number"
            />

            <ProviderTextField
              control={control}
              className="mb-4"
              label="Network Provider"
              name="network-provider"
              providerAttributesSchema={providerAttributesSchema}
              requiredMessage="Network provider is required."
            />
          </div>

          {/** RIGHT COLUMN */}
          <div>
            <ProviderMultiSelect
              control={control}
              className="mb-4"
              label="GPU models"
              name="hardware-gpu-model"
              providerAttributesSchema={providerAttributesSchema}
              requiredMessage="GPU models is required."
              optionName="hardware-gpu-model"
            />

            <ProviderSelect
              control={control}
              className="mb-4"
              label="CPU architecture"
              name="hardware-cpu-arch"
              providerAttributesSchema={providerAttributesSchema}
              requiredMessage="CPU architecture is required."
            />

            <ProviderMultiSelect
              control={control}
              className="mb-4"
              label="Disk Storage"
              name="hardware-disk"
              providerAttributesSchema={providerAttributesSchema}
              requiredMessage="At least one disk storage is required."
              optionName="hardware-disk"
            />

            <ProviderMultiSelect
              control={control}
              className="mb-4"
              label="Persistent Disk Storage"
              name="feat-persistent-storage-type"
              providerAttributesSchema={providerAttributesSchema}
              requiredMessage="At least one persistent disk storage is required."
              required={!!featPersistentStorage}
              optionName="feat-persistent-storage-type"
            />

            <ProviderTextField
              control={control}
              className="mb-4"
              label="Network Speed Upload"
              name="network-speed-up"
              providerAttributesSchema={providerAttributesSchema}
              requiredMessage="Network speed upload is required."
              type="number"
            />
          </div>
        </div>
      </FormPaper>

      <FormPaper className="mb-4">
        <p className="text-primary mb-8 text-lg">Features</p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/** LEFT COLUMN */}
          <div>
            <ProviderCheckbox
              control={control}
              providerAttributesSchema={providerAttributesSchema}
              className="mb-4"
              label="IP Leasing"
              name="feat-endpoint-ip"
            />

            <ProviderCheckbox
              control={control}
              providerAttributesSchema={providerAttributesSchema}
              className="mb-4"
              label="Chia support"
              name="workload-support-chia"
            />
          </div>

          {/** RIGHT COLUMN */}
          <div>
            <ProviderCheckbox
              control={control}
              providerAttributesSchema={providerAttributesSchema}
              className="mb-4"
              label="Custom Domain"
              name="feat-endpoint-custom-domain"
            />

            <ProviderMultiSelect
              control={control}
              className="mb-4"
              label="Chia capabilities"
              name="workload-support-chia-capabilities"
              providerAttributesSchema={providerAttributesSchema}
              requiredMessage="At least one chia capability is required."
              required={!!workloadSupportChia}
              optionName="workload-support-chia-capabilities"
            />
          </div>
        </div>
      </FormPaper>

      <FormPaper className="mb-4">
        <div className="mb-8 flex items-center">
          <p className="text-primary text-lg">Unknown attributes</p>

          <Button size="sm" color="secondary" className="ml-4" onClick={() => appendUnkownAttribute({ id: nanoid(), key: "", value: "" })}>
            Add attribute
          </Button>
        </div>

        <div>
          {unknownAttributes.length > 0 ? (
            unknownAttributes.map((att, attIndex) => {
              return (
                <div key={att.id} className={cn({ ["mb-4"]: attIndex + 1 !== _unknownAttributes?.length })}>
                  <div className="flex">
                    <div className="flex flex-grow items-center">
                      <div className="basis-1/2">
                        <Controller
                          control={control}
                          name={`unknown-attributes.${attIndex}.key`}
                          rules={{ required: "Key is required." }}
                          render={({ field, fieldState }) => (
                            <InputWithIcon
                              type="text"
                              // variant="outlined"
                              label="Key"
                              color="secondary"
                              className="w-full"
                              value={field.value}
                              error={fieldState.error?.message}
                              // helperText={fieldState.error?.message}
                              onChange={event => field.onChange(event.target.value)}
                            />
                          )}
                        />
                      </div>

                      <div className="ml-2 basis-1/2">
                        <Controller
                          control={control}
                          name={`unknown-attributes.${attIndex}.value`}
                          rules={{ required: "Key is required." }}
                          render={({ field, fieldState }) => (
                            <InputWithIcon
                              type="text"
                              // variant="outlined"
                              label="Value"
                              color="secondary"
                              className="w-full"
                              value={field.value}
                              error={fieldState.error?.message}
                              // helperText={fieldState.error?.message}
                              // size="small"
                              onChange={event => field.onChange(event.target.value)}
                            />
                          )}
                        />
                      </div>
                    </div>

                    <div className="pl-2">
                      <Button onClick={() => removeUnkownAttribute(attIndex)} size="icon">
                        <Bin />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-muted-foreground text-sm">None</p>
          )}
        </div>
      </FormPaper>

      {error && <Alert variant="destructive">{error}</Alert>}
      {formState.errors && (
        <Alert variant="destructive">
          {Object.entries(formState.errors).map(([key, value]) => {
            return <div key={key}>{value.message}</div>;
          })}
        </Alert>
      )}

      <div className="flex justify-end pt-4">
        <Button color="secondary" size="lg" variant="default" type="submit">
          Save
        </Button>
      </div>
    </form>
  );
};

type ProviderTextFieldProps = {
  control: Control<ProviderAttributesFormValues, any>;
  providerAttributesSchema: ProviderAttributesSchema;
  name: keyof ProviderAttributesFormValues;
  className?: string;
  requiredMessage: string;
  label: string;
  type?: HTMLInputTypeAttribute;
  required?: boolean;
  rules?: RegisterOptions<ProviderAttributesFormValues>;
  valueModifier?: (value: string) => string;
};
const ProviderTextField: React.FunctionComponent<ProviderTextFieldProps> = ({
  control,
  providerAttributesSchema,
  name,
  className,
  requiredMessage,
  label,
  rules = {},
  required = providerAttributesSchema[name].required,
  type = "text",
  valueModifier = value => value
}) => {
  return (
    <Controller
      control={control}
      name={name}
      rules={{
        required: required ? requiredMessage : undefined,
        ...rules
      }}
      render={({ field, fieldState }) => (
        <InputWithIcon
          type={type}
          // variant="outlined"
          label={label}
          color="secondary"
          tabIndex={0}
          error={fieldState.error?.message}
          // helperText={fieldState.error?.message}
          // fullWidth
          value={field.value as string}
          className={className}
          onChange={event => field.onChange(valueModifier(event.target.value || ""))}
          endIcon={
            <CustomTooltip
              title={
                <div>
                  <div>{providerAttributesSchema[name].description}</div>

                  <div>Attribute key: {providerAttributesSchema[name].key}</div>
                </div>
              }
            >
              <InfoCircle className="text-muted-foreground text-xs" />
            </CustomTooltip>
          }
        />
      )}
    />
  );
};

type ProviderCheckboxProps = {
  control: Control<ProviderAttributesFormValues, any>;
  providerAttributesSchema: ProviderAttributesSchema;
  name: keyof ProviderAttributesFormValues;
  className?: string;
  label: string;
};
const ProviderCheckbox: React.FunctionComponent<ProviderCheckboxProps> = ({ control, name, className, label, providerAttributesSchema }) => {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className={cn(className, "flex h-[42px] items-center")}>
          <CheckboxWithLabel label={label} checked={field.value as boolean} onCheckedChange={value => field.onChange(value)} />
          <div className="mx-2 flex items-center">
            <CustomTooltip
              title={
                <div>
                  <div>{providerAttributesSchema[name].description}</div>

                  <div>Attribute key: {providerAttributesSchema[name].key}</div>
                </div>
              }
            >
              <InfoCircle className="text-muted-foreground text-xs" />
            </CustomTooltip>
          </div>
        </div>
      )}
    />
  );
};

type ProviderSelectProps = {
  control: Control<ProviderAttributesFormValues, any>;
  providerAttributesSchema: ProviderAttributesSchema;
  name: keyof ProviderAttributesFormValues;
  className?: string;
  requiredMessage: string;
  label: string;
  required?: boolean;
  placeholder?: string;
};
const ProviderSelect: React.FunctionComponent<ProviderSelectProps> = ({
  control,
  providerAttributesSchema,
  name,
  className,
  requiredMessage,
  label,
  required = providerAttributesSchema[name].required,
  placeholder
}) => {
  const options = (providerAttributesSchema[name].values || []) as ProviderAttributeSchemaDetailValue[];

  return (
    <Controller
      control={control}
      name={name}
      rules={{
        required: required ? requiredMessage : undefined
      }}
      render={({ field }) => (
        <FormItem className={cn("w-full", className)}>
          <Label className="flex items-center">
            {label}

            <CustomTooltip
              title={
                <div>
                  <div>{providerAttributesSchema[name].description}</div>

                  <div>Attribute key: {providerAttributesSchema[name].key}</div>
                </div>
              }
            >
              <InfoCircle className="text-muted-foreground ml-2 text-xs" />
            </CustomTooltip>
          </Label>
          <Select value={(field.value as string) || ""} onValueChange={field.onChange}>
            <SelectTrigger>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {options.map(option => {
                  return (
                    <SelectItem key={option.key} value={option.key}>
                      <div className="flex w-full items-center justify-between">
                        <div>{option.description}</div>
                        {option.value}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectGroup>
            </SelectContent>
          </Select>
        </FormItem>
      )}
    />
  );
};

type ProviderMultiSelectProps = {
  control: Control<any, any>;
  providerAttributesSchema: ProviderAttributesSchema;
  optionName: keyof ProviderAttributesSchema;
  name: FieldPath<ProviderAttributesFormValues>;
  className?: string;
  requiredMessage?: string;
  label: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  valueType?: "key" | "description ";
};
export const ProviderMultiSelect: React.FunctionComponent<ProviderMultiSelectProps> = ({
  control,
  providerAttributesSchema,
  optionName,
  name,
  className,
  requiredMessage,
  label,
  required = providerAttributesSchema[optionName || ""]?.required || false,
  placeholder,
  disabled,
  valueType = "description"
}) => {
  const options: ProviderAttributeSchemaDetailValue[] = providerAttributesSchema[optionName || ""]?.values || [];

  return (
    <Controller
      control={control}
      name={name}
      rules={{
        required: required ? requiredMessage : undefined
      }}
      render={({ field }) => (
        <div className={cn(className)}>
          <Label className="flex items-center">
            {label}

            <CustomTooltip
              title={
                <div>
                  <div>{providerAttributesSchema[name].description}</div>

                  <div>Attribute key: {providerAttributesSchema[name].key}</div>
                </div>
              }
            >
              <InfoCircle className="text-muted-foreground ml-2 text-xs" />
            </CustomTooltip>
          </Label>
          <MultipleSelector
            value={
              (field.value as ProviderAttributeSchemaDetailValue[]).map(v => ({
                value: v.key,
                label: (valueType === "key" ? v?.key : v?.description) || ""
              })) || []
            }
            options={options.map(v => ({ value: v.key, label: (valueType === "key" ? v?.key : v?.description) || "" })) || []}
            hidePlaceholderWhenSelected
            placeholder={placeholder}
            emptyIndicator={<p className="text-center text-lg leading-10 text-gray-600 dark:text-gray-400">no results found.</p>}
            disabled={disabled}
            className="mt-2"
            onChange={(newValue: Option[]) => {
              field.onChange(newValue.map(v => ({ key: v.value, description: v.label })));
            }}
          />
        </div>
      )}
    />
  );
};
