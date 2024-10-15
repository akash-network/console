"use client";
import { HTMLInputTypeAttribute, useEffect, useRef, useState } from "react";
import { Control, FieldPath, useFieldArray, useForm } from "react-hook-form";
import {
  Alert,
  Button,
  CheckboxWithLabel,
  CustomTooltip,
  Form,
  FormField,
  FormInput,
  FormItem,
  FormLabel,
  FormMessage,
  MultipleSelector,
  MultiSelectorOption,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import { Bin, InfoCircle } from "iconoir-react";
import { nanoid } from "nanoid";
import { z } from "zod";

import { FormPaper } from "@src/components/sdl/FormPaper";
import { useWallet } from "@src/context/WalletProvider";
import { ApiProviderDetail } from "@src/types/provider";
import { ProviderAttributeSchemaDetailValue, providerAttributesFormValuesSchema, ProviderAttributesSchema } from "@src/types/providerAttributes";
import { defaultProviderAttributes } from "@src/utils/providerAttributes/data";
import { getUnknownAttributes, mapFormValuesToAttributes } from "@src/utils/providerAttributes/helpers";
import { cn } from "@akashnetwork/ui/utils";
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
  const form = useForm<z.infer<typeof providerAttributesFormValuesSchema>>({
    defaultValues: {
      ...defaultProviderAttributes
    },
    resolver: zodResolver(providerAttributesFormValuesSchema)
  });
  const { handleSubmit, control, watch, setValue, formState } = form;
  const {
    fields: unknownAttributes,
    remove: removeUnkownAttribute,
    append: appendUnkownAttribute
  } = useFieldArray({
    control,
    name: "unknown-attributes",
    keyName: "id"
  });
  const { "unknown-attributes": _unknownAttributes } = watch();

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

  const onSubmit = async (data: z.infer<typeof providerAttributesFormValuesSchema>) => {
    setError(null);

    try {
      const attributes = mapFormValuesToAttributes(data, providerAttributesSchema);

      const message = TransactionMessageData.getUpdateProviderMsg(provider?.owner || "", data["host-uri"], attributes, {
        email: data.email,
        website: data.website || ""
      });
      await signAndBroadcastTx([message]);
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)} ref={formRef} autoComplete="off">
        <FormPaper className="mb-4">
          <p className="mb-8 text-lg text-primary">General info</p>

          <FormField
            control={control}
            name="host-uri"
            render={({ field }) => (
              <FormInput
                type="text"
                label="Host URI"
                tabIndex={0}
                value={field.value}
                className="mb-4"
                onChange={event => field.onChange(event.target.value || "")}
                endIcon={
                  <CustomTooltip title="Host URI is the URI of the host that is running the provider. It is used to identify the provider.">
                    <InfoCircle className="ml-2 text-xs text-muted-foreground" />
                  </CustomTooltip>
                }
              />
            )}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/** LEFT COLUMN */}
            <div>
              <ProviderTextField control={control} className="mb-4" label="Host" name="host" providerAttributesSchema={providerAttributesSchema} />

              <ProviderTextField control={control} className="mb-4" label="Website" name="website" providerAttributesSchema={providerAttributesSchema} />

              <ProviderTextField
                control={control}
                className="mb-4"
                label="Status Page"
                name="status-page"
                providerAttributesSchema={providerAttributesSchema}
              />

              <ProviderTextField
                control={control}
                className="mb-4"
                label="Country"
                name="country"
                providerAttributesSchema={providerAttributesSchema}
                valueModifier={value => value?.toUpperCase()}
              />

              <ProviderSelect control={control} className="mb-4" label="Timezone" name="timezone" providerAttributesSchema={providerAttributesSchema} />

              <ProviderTextField
                control={control}
                className="mb-4"
                label="Hosting Provider"
                name="hosting-provider"
                providerAttributesSchema={providerAttributesSchema}
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
              />

              <ProviderTextField
                control={control}
                className="mb-4"
                label="Organization"
                name="organization"
                providerAttributesSchema={providerAttributesSchema}
              />

              <ProviderSelect
                control={control}
                className="mb-4"
                label="Location Region"
                name="location-region"
                providerAttributesSchema={providerAttributesSchema}
              />

              <ProviderTextField
                control={control}
                className="mb-4"
                label="City"
                name="city"
                providerAttributesSchema={providerAttributesSchema}
                valueModifier={value => value?.toUpperCase()}
              />

              <ProviderSelect
                control={control}
                className="mb-4"
                label="Location type"
                name="location-type"
                providerAttributesSchema={providerAttributesSchema}
              />

              <ProviderSelect control={control} className="mb-4" label="Tier" name="tier" providerAttributesSchema={providerAttributesSchema} />
            </div>
          </div>
        </FormPaper>

        <FormPaper className="mb-4">
          <p className="mb-8 text-lg text-primary">Hardware specifications</p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/** LEFT COLUMN */}
            <div>
              <ProviderSelect control={control} className="mb-4" label="GPU" name="hardware-gpu" providerAttributesSchema={providerAttributesSchema} />
              <ProviderSelect control={control} className="mb-4" label="CPU" name="hardware-cpu" providerAttributesSchema={providerAttributesSchema} />

              <ProviderSelect
                control={control}
                className="mb-4"
                label="Memory (RAM)"
                name="hardware-memory"
                providerAttributesSchema={providerAttributesSchema}
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
                type="number"
              />

              <ProviderTextField
                control={control}
                className="mb-4"
                label="Network Provider"
                name="network-provider"
                providerAttributesSchema={providerAttributesSchema}
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
                optionName="hardware-gpu-model"
              />

              <ProviderSelect
                control={control}
                className="mb-4"
                label="CPU architecture"
                name="hardware-cpu-arch"
                providerAttributesSchema={providerAttributesSchema}
              />

              <ProviderMultiSelect
                control={control}
                className="mb-4"
                label="Disk Storage"
                name="hardware-disk"
                providerAttributesSchema={providerAttributesSchema}
                optionName="hardware-disk"
              />

              <ProviderMultiSelect
                control={control}
                className="mb-4"
                label="Persistent Disk Storage"
                name="feat-persistent-storage-type"
                providerAttributesSchema={providerAttributesSchema}
                optionName="feat-persistent-storage-type"
              />

              <ProviderTextField
                control={control}
                className="mb-4"
                label="Network Speed Upload"
                name="network-speed-up"
                providerAttributesSchema={providerAttributesSchema}
                type="number"
              />
            </div>
          </div>
        </FormPaper>

        <FormPaper className="mb-4">
          <p className="mb-8 text-lg text-primary">Features</p>

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
                optionName="workload-support-chia-capabilities"
              />
            </div>
          </div>
        </FormPaper>

        <FormPaper className="mb-4">
          <div className="mb-8 flex items-center">
            <p className="text-lg text-primary">Unknown attributes</p>

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
                          <FormField
                            control={control}
                            name={`unknown-attributes.${attIndex}.key`}
                            render={({ field }) => <FormInput {...field} type="text" label="Key" className="w-full" />}
                          />
                        </div>

                        <div className="ml-2 basis-1/2">
                          <FormField
                            control={control}
                            name={`unknown-attributes.${attIndex}.value`}
                            render={({ field }) => <FormInput {...field} type="text" label="Value" className="w-full" />}
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
              <p className="text-sm text-muted-foreground">None</p>
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
    </Form>
  );
};

type ProviderTextFieldProps = {
  control: Control<z.infer<typeof providerAttributesFormValuesSchema>, any>;
  providerAttributesSchema: ProviderAttributesSchema;
  name: keyof z.infer<typeof providerAttributesFormValuesSchema>;
  className?: string;
  label: string;
  type?: HTMLInputTypeAttribute;
  valueModifier?: (value: string) => string;
};
const ProviderTextField: React.FunctionComponent<ProviderTextFieldProps> = ({
  control,
  providerAttributesSchema,
  name,
  className,
  label,
  type = "text",
  valueModifier = value => value
}) => {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormInput
          type={type}
          label={label}
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
              <InfoCircle className="text-xs text-muted-foreground" />
            </CustomTooltip>
          }
        />
      )}
    />
  );
};

type ProviderCheckboxProps = {
  control: Control<z.infer<typeof providerAttributesFormValuesSchema>, any>;
  providerAttributesSchema: ProviderAttributesSchema;
  name: keyof z.infer<typeof providerAttributesFormValuesSchema>;
  className?: string;
  label: string;
};
const ProviderCheckbox: React.FunctionComponent<ProviderCheckboxProps> = ({ control, name, className, label, providerAttributesSchema }) => {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
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
                <InfoCircle className="text-xs text-muted-foreground" />
              </CustomTooltip>
            </div>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

type ProviderSelectProps = {
  control: Control<z.infer<typeof providerAttributesFormValuesSchema>, any>;
  providerAttributesSchema: ProviderAttributesSchema;
  name: keyof z.infer<typeof providerAttributesFormValuesSchema>;
  className?: string;
  label: string;
  placeholder?: string;
};
const ProviderSelect: React.FunctionComponent<ProviderSelectProps> = ({ control, providerAttributesSchema, name, className, label, placeholder }) => {
  const options = (providerAttributesSchema[name].values || []) as ProviderAttributeSchemaDetailValue[];

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={cn("w-full", className)}>
          <FormLabel className="flex items-center">
            {label}

            <CustomTooltip
              title={
                <div>
                  <div>{providerAttributesSchema[name].description}</div>

                  <div>Attribute key: {providerAttributesSchema[name].key}</div>
                </div>
              }
            >
              <InfoCircle className="ml-2 text-xs text-muted-foreground" />
            </CustomTooltip>
          </FormLabel>
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
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

type ProviderMultiSelectProps = {
  control: Control<any, any>;
  providerAttributesSchema: ProviderAttributesSchema;
  optionName: keyof ProviderAttributesSchema;
  name: FieldPath<z.infer<typeof providerAttributesFormValuesSchema>>;
  className?: string;
  label: string;
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
  label,
  placeholder,
  disabled,
  valueType = "description"
}) => {
  const options: ProviderAttributeSchemaDetailValue[] = providerAttributesSchema[optionName || ""]?.values || [];

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel className="flex items-center">
            {label}

            <CustomTooltip
              title={
                <div>
                  <div>{providerAttributesSchema[name].description}</div>

                  <div>Attribute key: {providerAttributesSchema[name].key}</div>
                </div>
              }
            >
              <InfoCircle className="ml-2 text-xs text-muted-foreground" />
            </CustomTooltip>
          </FormLabel>
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
            onChange={(newValue: MultiSelectorOption[]) => {
              field.onChange(newValue.map(v => ({ key: v.value, description: v.label })));
            }}
          />
          <FormMessage />
        </FormItem>
      )}
    />
  );
};
