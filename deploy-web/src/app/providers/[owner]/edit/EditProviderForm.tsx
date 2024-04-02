"use client";
import { useState, useEffect, useRef, HTMLInputTypeAttribute } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@src/context/WalletProvider";
import { ApiProviderDetail } from "@src/types/provider";
import { Control, Controller, FieldPath, RegisterOptions, useFieldArray, useForm } from "react-hook-form";
import { ProviderAttributeSchemaDetailValue, ProviderAttributesFormValues, ProviderAttributesSchema } from "@src/types/providerAttributes";
import { defaultProviderAttributes } from "@src/utils/providerAttributes/data";
import { CustomTooltip } from "@src/components/shared/CustomTooltip";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { getUnknownAttributes, mapFormValuesToAttributes } from "@src/utils/providerAttributes/helpers";
import { nanoid } from "nanoid";
import { FormPaper } from "@src/components/sdl/FormPaper";
import { Alert } from "@src/components/ui/alert";
import { Button } from "@src/components/ui/button";
import { Input, InputWithIcon } from "@src/components/ui/input";
import { Bin, InfoCircle } from "iconoir-react";
import { CheckboxWithLabel } from "@src/components/ui/checkbox";
import { cn } from "@src/utils/styleUtils";
import MultipleSelector, { Option } from "@src/components/ui/multiple-selector";
import { Label } from "@src/components/ui/label";
import { FormItem } from "@src/components/ui/form";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@src/components/ui/select";

type Props = {
  provider: Partial<ApiProviderDetail>;
  providerAttributesSchema: ProviderAttributesSchema;
};

// const useStyles = makeStyles()(theme => ({
//   textfieldSpacing: {
//     marginBottom: "1rem"
//   },
//   grid: {
//     display: "grid",
//     gridTemplateColumns: "repeat(2,1fr)",
//     gap: "1rem",
//     [theme.breakpoints.down("sm")]: {
//       gridTemplateColumns: "repeat(1,1fr)"
//     }
//   },
//   paper: {
//     padding: "1rem",
//     marginBottom: "1rem"
//   },
//   title: {
//     marginBottom: "2rem",
//     color: theme.palette.text.secondary
//   }
// }));

export const EditProviderForm: React.FunctionComponent<Props> = ({ provider, providerAttributesSchema }) => {
  const [error, setError] = useState(null);
  const formRef = useRef<HTMLFormElement>(null);
  const { signAndBroadcastTx } = useWallet();
  const { handleSubmit, reset, control, trigger, watch, setValue } = useForm<ProviderAttributesFormValues>({
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
  }, []);

  const onSubmit = async (data: ProviderAttributesFormValues) => {
    setError(null);

    try {
      const attributes = mapFormValuesToAttributes(data, providerAttributesSchema);
      console.log(data, attributes);

      try {
        const message = TransactionMessageData.getUpdateProviderMsg(provider?.owner || "", data["host-uri"], attributes, {
          email: data.email,
          website: data.website
        });
        await signAndBroadcastTx([message]);
      } catch (error) {
        throw error;
      }
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} ref={formRef} autoComplete="off">
      <FormPaper>
        <p className="mb-8 text-lg text-primary">General info</p>

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
                  <InfoCircle className="ml-2 text-xs text-muted-foreground" />
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

      <FormPaper>
        <p className="mb-8 text-lg text-primary">Hardware specifications</p>

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
            />

            <ProviderMultiSelect
              control={control}
              className="mb-4"
              label="Persistent Disk Storage"
              name="feat-persistent-storage-type"
              providerAttributesSchema={providerAttributesSchema}
              requiredMessage="At least one persistent disk storage is required."
              required={!!featPersistentStorage}
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

      <FormPaper>
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
              requiredMessage="At least one chia capability is required."
              required={!!workloadSupportChia}
            />
          </div>
        </div>
      </FormPaper>

      <FormPaper>
        <div className="mb-8 flex items-center">
          <p className="mb-8 text-lg text-primary">Unknown attributes</p>

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
            <p className="text-sm text-muted-foreground">None</p>
          )}
        </div>
      </FormPaper>

      {error && <Alert variant="destructive">{error}</Alert>}

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
          // size="small"
          onChange={event => field.onChange(valueModifier(event.target.value || ""))}
          inputClassName="h-[42px]"
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
          // InputProps={{
          //   sx: {
          //     height: "42px"
          //   },
          //   endAdornment: (
          //     <InputAdornment position="end">
          //       <CustomTooltip
          //         arrow
          //         title={
          //           <div>
          //             <div>{providerAttributesSchema[name].description}</div>

          //             <div>Attribute key: {providerAttributesSchema[name].key}</div>
          //           </div>
          //         }
          //       >
          //         <InfoIcon color="disabled" fontSize="small" />
          //       </CustomTooltip>
          //     </InputAdornment>
          //   )
          // }}
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
          <CheckboxWithLabel label={label} checked={field.value as boolean} onChange={value => field.onChange(value)} />
          <div className="mx-2 flex items-center">
            <CustomTooltip
              title={
                <div>
                  <div>{providerAttributesSchema[name].description}</div>

                  <div>Attribute key: {providerAttributesSchema[name].key}</div>
                </div>
              }
            >
              <InfoCircle className="text-sm text-muted-foreground" />
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
  const [isOpen, setIsOpen] = useState(false);
  const options = (providerAttributesSchema[name].values || []) as ProviderAttributeSchemaDetailValue[];

  return (
    <Controller
      control={control}
      name={name}
      rules={{
        required: required ? requiredMessage : undefined
      }}
      render={({ field, fieldState }) => (
        <div className={cn(className, "flex items-center")}>
          {/* <Autocomplete
            disableClearable
            open={isOpen}
            options={options}
            value={field.value || (multiple ? ([] as any) : null)}
            getOptionLabel={option => option.description}
            defaultValue={multiple ? [] : null}
            isOptionEqualToValue={(option, value) => option.key === value.key}
            filterSelectedOptions
            fullWidth
            multiple={multiple}
            ChipProps={{ size: "small" }}
            onChange={(event, newValue: string[] | null | ProviderAttributeSchemaDetailValue[]) => {
              field.onChange(newValue);
            }}
            renderInput={params => (
              <ClickAwayListener onClickAway={() => setIsOpen(false)}>
                <TextField
                  {...params}
                  label={label}
                  variant="outlined"
                  color="secondary"
                  size="small"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  onClick={() => setIsOpen(prev => !prev)}
                  sx={{ minHeight: "42px" }}
                />
              </ClickAwayListener>
            )}
            renderOption={(props, option) => {
              return (
                <li
                  component="li"
                  sx={{ display: "flex", alignItems: "center", justifyContent: "space-between !important", width: "100%", padding: ".2rem .5rem" }}
                  {...props}
                  key={option.key}
                >
                  <div>{option.description}</div>
                </li>
              );
            }}
          /> */}

          <FormItem>
            <Label>{label}</Label>
            <Select value={(field.value as string) || ""} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {options.map(option => {
                    return (
                      <SelectItem key={option.key} value={option.value} className="flex w-full items-center justify-between px-2 py-1">
                        <div>{option.description}</div>
                        {option.value}
                      </SelectItem>
                    );
                  })}
                </SelectGroup>
              </SelectContent>
            </Select>
          </FormItem>

          <div className="mx-4 flex items-center">
            <CustomTooltip
              title={
                <div>
                  <div>{providerAttributesSchema[name].description}</div>

                  <div>Attribute key: {providerAttributesSchema[name].key}</div>
                </div>
              }
            >
              <InfoCircle className="text-sm text-muted-foreground" />
            </CustomTooltip>
          </div>
        </div>
      )}
    />
  );
};

type ProviderMultiSelectProps = {
  control: Control<any, any>;
  providerAttributesSchema: ProviderAttributesSchema;
  optionName?: keyof ProviderAttributesSchema;
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
          <Label>{label}</Label>
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
