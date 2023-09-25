import { useState, useEffect, useRef, HTMLInputTypeAttribute } from "react";
import { makeStyles } from "tss-react/mui";
import { useRouter } from "next/router";
import { useKeplr } from "@src/context/KeplrWalletProvider";
import { ApiProviderDetail } from "@src/types/provider";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  ClickAwayListener,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Paper,
  TextField,
  Typography
} from "@mui/material";
import { Control, Controller, RegisterOptions, useFieldArray, useForm } from "react-hook-form";
import { ProviderAttributeSchemaDetailValue, ProviderAttributesFormValues, ProviderAttributesSchema } from "@src/types/providerAttributes";
import { defaultProviderAttributes } from "@src/utils/providerAttributes/data";
import { CustomTooltip } from "@src/components/shared/CustomTooltip";
import InfoIcon from "@mui/icons-material/Info";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { getUnknownAttributes, mapFormValuesToAttributes } from "@src/utils/providerAttributes/helpers";
import DeleteIcon from "@mui/icons-material/Delete";
import { nanoid } from "nanoid";

type Props = {
  provider: Partial<ApiProviderDetail>;
  providerAttributesSchema: ProviderAttributesSchema;
};

const useStyles = makeStyles()(theme => ({
  textfieldSpacing: {
    marginBottom: "1rem"
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(2,1fr)",
    gap: "1rem",
    [theme.breakpoints.down("sm")]: {
      gridTemplateColumns: "repeat(1,1fr)"
    }
  },
  paper: {
    padding: "1rem",
    marginBottom: "1rem"
  },
  title: {
    marginBottom: "2rem",
    color: theme.palette.text.secondary
  }
}));

export const EditProviderForm: React.FunctionComponent<Props> = ({ provider, providerAttributesSchema }) => {
  const { classes } = useStyles();
  const router = useRouter();
  const [error, setError] = useState(null);
  const formRef = useRef<HTMLFormElement>();
  const { address, signAndBroadcastTx } = useKeplr();
  const {
    handleSubmit,
    reset,
    control,
    formState: { isValid, errors },
    trigger,
    watch,
    setValue
  } = useForm<ProviderAttributesFormValues>({
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
      return provider.attributes.find(x => x.key === key)?.value || "";
    };

    const getAttributeOptionValue = (key: string) => {
      const _key = providerAttributesSchema[key].key as string;
      const possibleValues = providerAttributesSchema[key].values as ProviderAttributeSchemaDetailValue[];
      const attributeValue = provider.attributes.find(x => x.key === _key);
      return possibleValues.find(x => x.key === attributeValue?.value);
    };

    const getAttributeMultipleOptionValue = (key: string) => {
      const possibleValues = providerAttributesSchema[key].values as ProviderAttributeSchemaDetailValue[];

      return possibleValues.filter(x => provider.attributes.some(y => x.key === y.key));
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

    const unknownAttributes = getUnknownAttributes(provider.attributes, providerAttributesSchema);

    setValue("host-uri", provider.hostUri);
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
        const message = TransactionMessageData.getUpdateProviderMsg(provider.owner, data["host-uri"], attributes, {
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
      <Paper className={classes.paper}>
        <Typography variant="body1" className={classes.title}>
          General info
        </Typography>

        <Controller
          control={control}
          name="host-uri"
          rules={{
            required: "Host URI is required"
          }}
          render={({ field, fieldState }) => (
            <TextField
              type="text"
              variant="outlined"
              label="Host URI"
              color="secondary"
              tabIndex={0}
              error={!!fieldState.error}
              helperText={fieldState.error?.message}
              fullWidth
              value={field.value}
              className={classes.textfieldSpacing}
              size="small"
              onChange={event => field.onChange(event.target.value || "")}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <CustomTooltip arrow title="Host URI is the URI of the host that is running the provider. It is used to identify the provider.">
                      <InfoIcon color="disabled" fontSize="small" />
                    </CustomTooltip>
                  </InputAdornment>
                )
              }}
            />
          )}
        />

        <Box className={classes.grid}>
          {/** LEFT COLUMN */}
          <Box>
            <ProviderTextField
              control={control}
              className={classes.textfieldSpacing}
              label="Host"
              name="host"
              providerAttributesSchema={providerAttributesSchema}
              requiredMessage="Host is required."
            />

            <ProviderTextField
              control={control}
              className={classes.textfieldSpacing}
              label="Website"
              name="website"
              providerAttributesSchema={providerAttributesSchema}
              requiredMessage="Website is required."
            />

            <ProviderTextField
              control={control}
              className={classes.textfieldSpacing}
              label="Status Page"
              name="status-page"
              providerAttributesSchema={providerAttributesSchema}
              requiredMessage="Status page is required."
            />

            <ProviderTextField
              control={control}
              className={classes.textfieldSpacing}
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
              className={classes.textfieldSpacing}
              label="Timezone"
              name="timezone"
              providerAttributesSchema={providerAttributesSchema}
              requiredMessage="Timezone is required."
            />

            <ProviderTextField
              control={control}
              className={classes.textfieldSpacing}
              label="Hosting Provider"
              name="hosting-provider"
              providerAttributesSchema={providerAttributesSchema}
              requiredMessage="Hosting provider is required."
            />
          </Box>
          {/** RIGHT COLUMN */}
          <Box>
            <ProviderTextField
              control={control}
              className={classes.textfieldSpacing}
              label="Email"
              name="email"
              type="email"
              providerAttributesSchema={providerAttributesSchema}
              requiredMessage="Email is required."
            />

            <ProviderTextField
              control={control}
              className={classes.textfieldSpacing}
              label="Organization"
              name="organization"
              providerAttributesSchema={providerAttributesSchema}
              requiredMessage="Organization is required."
            />

            <ProviderSelect
              control={control}
              className={classes.textfieldSpacing}
              label="Location Region"
              name="location-region"
              providerAttributesSchema={providerAttributesSchema}
              requiredMessage="Location Region is required."
            />

            <ProviderTextField
              control={control}
              className={classes.textfieldSpacing}
              label="City"
              name="city"
              providerAttributesSchema={providerAttributesSchema}
              requiredMessage="City is required."
              rules={{ maxLength: { value: 3, message: "City must be 3 letter code." }, minLength: { value: 3, message: "City must be 3 letter code." } }}
              valueModifier={value => value?.toUpperCase()}
            />

            <ProviderSelect
              control={control}
              className={classes.textfieldSpacing}
              label="Location type"
              name="location-type"
              providerAttributesSchema={providerAttributesSchema}
              requiredMessage="Location type is required."
            />

            <ProviderSelect
              control={control}
              className={classes.textfieldSpacing}
              label="Tier"
              name="tier"
              providerAttributesSchema={providerAttributesSchema}
              requiredMessage="Tier is required."
            />
          </Box>
        </Box>
      </Paper>

      <Paper className={classes.paper}>
        <Typography variant="body1" className={classes.title}>
          Hardware specifications
        </Typography>

        <Box className={classes.grid}>
          {/** LEFT COLUMN */}
          <Box>
            <ProviderSelect
              control={control}
              className={classes.textfieldSpacing}
              label="GPU"
              name="hardware-gpu"
              providerAttributesSchema={providerAttributesSchema}
              requiredMessage="GPU is required."
            />
            <ProviderSelect
              control={control}
              className={classes.textfieldSpacing}
              label="CPU"
              name="hardware-cpu"
              providerAttributesSchema={providerAttributesSchema}
              requiredMessage="CPU is required."
            />

            <ProviderSelect
              control={control}
              className={classes.textfieldSpacing}
              label="Memory (RAM)"
              name="hardware-memory"
              providerAttributesSchema={providerAttributesSchema}
              requiredMessage="Memory is required."
            />

            <ProviderCheckbox
              control={control}
              providerAttributesSchema={providerAttributesSchema}
              className={classes.textfieldSpacing}
              label="Persistent storage"
              name="feat-persistent-storage"
            />

            <ProviderTextField
              control={control}
              className={classes.textfieldSpacing}
              label="Network Speed Download"
              name="network-speed-down"
              providerAttributesSchema={providerAttributesSchema}
              requiredMessage="Network speed download is required."
              type="number"
            />

            <ProviderTextField
              control={control}
              className={classes.textfieldSpacing}
              label="Network Provider"
              name="network-provider"
              providerAttributesSchema={providerAttributesSchema}
              requiredMessage="Network provider is required."
            />
          </Box>

          {/** RIGHT COLUMN */}
          <Box>
            <ProviderSelect
              control={control}
              className={classes.textfieldSpacing}
              label="GPU models"
              name="hardware-gpu-model"
              providerAttributesSchema={providerAttributesSchema}
              requiredMessage="GPU models is required."
              multiple
            />

            <ProviderSelect
              control={control}
              className={classes.textfieldSpacing}
              label="CPU architecture"
              name="hardware-cpu-arch"
              providerAttributesSchema={providerAttributesSchema}
              requiredMessage="CPU architecture is required."
            />

            <ProviderSelect
              control={control}
              className={classes.textfieldSpacing}
              label="Disk Storage"
              name="hardware-disk"
              multiple
              providerAttributesSchema={providerAttributesSchema}
              requiredMessage="At least one disk storage is required."
            />

            <ProviderSelect
              control={control}
              className={classes.textfieldSpacing}
              label="Persistent Disk Storage"
              name="feat-persistent-storage-type"
              multiple
              providerAttributesSchema={providerAttributesSchema}
              requiredMessage="At least one persistent disk storage is required."
              required={!!featPersistentStorage}
            />

            <ProviderTextField
              control={control}
              className={classes.textfieldSpacing}
              label="Network Speed Upload"
              name="network-speed-up"
              providerAttributesSchema={providerAttributesSchema}
              requiredMessage="Network speed upload is required."
              type="number"
            />
          </Box>
        </Box>
      </Paper>

      <Paper className={classes.paper}>
        <Typography variant="body1" className={classes.title}>
          Features
        </Typography>

        <Box className={classes.grid}>
          {/** LEFT COLUMN */}
          <Box>
            <ProviderCheckbox
              control={control}
              providerAttributesSchema={providerAttributesSchema}
              className={classes.textfieldSpacing}
              label="IP Leasing"
              name="feat-endpoint-ip"
            />

            <ProviderCheckbox
              control={control}
              providerAttributesSchema={providerAttributesSchema}
              className={classes.textfieldSpacing}
              label="Chia support"
              name="workload-support-chia"
            />
          </Box>

          {/** RIGHT COLUMN */}
          <Box>
            <ProviderCheckbox
              control={control}
              providerAttributesSchema={providerAttributesSchema}
              className={classes.textfieldSpacing}
              label="Custom Domain"
              name="feat-endpoint-custom-domain"
            />

            <ProviderSelect
              control={control}
              className={classes.textfieldSpacing}
              label="Chia capabilities"
              name="workload-support-chia-capabilities"
              multiple
              providerAttributesSchema={providerAttributesSchema}
              requiredMessage="At least one chia capability is required."
              required={!!workloadSupportChia}
            />
          </Box>
        </Box>
      </Paper>

      <Paper className={classes.paper}>
        <Box sx={{ display: "flex", alignItems: "center" }} className={classes.title}>
          <Typography variant="body1">Unknown attributes</Typography>

          <Button
            size="small"
            color="secondary"
            variant="contained"
            sx={{ marginLeft: "1rem" }}
            onClick={() => appendUnkownAttribute({ id: nanoid(), key: "", value: "" })}
          >
            Add attribute
          </Button>
        </Box>

        <Box>
          {unknownAttributes.length > 0 ? (
            unknownAttributes.map((att, attIndex) => {
              return (
                <Box key={att.id} sx={{ marginBottom: attIndex + 1 === _unknownAttributes.length ? 0 : "1rem" }}>
                  <Box sx={{ display: "flex" }}>
                    <Box sx={{ flexGrow: 1, display: "flex", alignItems: "center" }}>
                      <Box sx={{ flexBasis: "50%" }}>
                        <Controller
                          control={control}
                          name={`unknown-attributes.${attIndex}.key`}
                          rules={{ required: "Key is required." }}
                          render={({ field, fieldState }) => (
                            <TextField
                              type="text"
                              variant="outlined"
                              label="Key"
                              color="secondary"
                              fullWidth
                              value={field.value}
                              error={!!fieldState.error}
                              helperText={fieldState.error?.message}
                              size="small"
                              onChange={event => field.onChange(event.target.value)}
                            />
                          )}
                        />
                      </Box>

                      <Box sx={{ marginLeft: ".5rem", flexBasis: "50%" }}>
                        <Controller
                          control={control}
                          name={`unknown-attributes.${attIndex}.value`}
                          rules={{ required: "Key is required." }}
                          render={({ field, fieldState }) => (
                            <TextField
                              type="text"
                              variant="outlined"
                              label="Value"
                              color="secondary"
                              fullWidth
                              value={field.value}
                              error={!!fieldState.error}
                              helperText={fieldState.error?.message}
                              size="small"
                              onChange={event => field.onChange(event.target.value)}
                            />
                          )}
                        />
                      </Box>
                    </Box>

                    <Box sx={{ paddingLeft: ".5rem" }}>
                      <IconButton onClick={() => removeUnkownAttribute(attIndex)} size="small">
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </Box>
                </Box>
              );
            })
          ) : (
            <Typography variant="caption">None</Typography>
          )}
        </Box>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}

      <Box sx={{ paddingTop: "1rem", display: "flex", justifyContent: "end" }}>
        <Button color="secondary" size="large" variant="contained" type="submit">
          Save
        </Button>
      </Box>
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
  rules?: RegisterOptions;
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
        required: required ? requiredMessage : null,
        ...rules
      }}
      render={({ field, fieldState }) => (
        <TextField
          type={type}
          variant="outlined"
          label={label}
          color="secondary"
          tabIndex={0}
          error={!!fieldState.error}
          helperText={fieldState.error?.message}
          fullWidth
          value={field.value}
          className={className}
          size="small"
          onChange={event => field.onChange(valueModifier(event.target.value || ""))}
          InputProps={{
            sx: {
              height: "42px"
            },
            endAdornment: (
              <InputAdornment position="end">
                <CustomTooltip
                  arrow
                  title={
                    <div>
                      <div>{providerAttributesSchema[name].description}</div>

                      <div>Attribute key: {providerAttributesSchema[name].key}</div>
                    </div>
                  }
                >
                  <InfoIcon color="disabled" fontSize="small" />
                </CustomTooltip>
              </InputAdornment>
            )
          }}
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
      render={({ field, fieldState }) => (
        <Box sx={{ display: "flex", alignItems: "center", height: "42px" }} className={className}>
          <FormControlLabel
            control={<Checkbox color="secondary" checked={field.value as boolean} onChange={ev => field.onChange(ev.target.checked)} size="small" />}
            label={label}
          />
          <Box sx={{ display: "flex", alignItems: "center", margin: "0 .9rem" }}>
            <CustomTooltip
              arrow
              title={
                <div>
                  <div>{providerAttributesSchema[name].description}</div>

                  <div>Attribute key: {providerAttributesSchema[name].key}</div>
                </div>
              }
            >
              <InfoIcon color="disabled" fontSize="small" />
            </CustomTooltip>
          </Box>
        </Box>
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
  multiple?: boolean;
  required?: boolean;
};
const ProviderSelect: React.FunctionComponent<ProviderSelectProps> = ({
  control,
  providerAttributesSchema,
  name,
  className,
  requiredMessage,
  label,
  required = providerAttributesSchema[name].required,
  multiple
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const options = providerAttributesSchema[name].values || [];

  return (
    <Controller
      control={control}
      name={name}
      rules={{
        required: required ? requiredMessage : null
      }}
      render={({ field, fieldState }) => (
        <Box sx={{ display: "flex", alignItems: "center" }} className={className}>
          <Autocomplete
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
                <Box
                  component="li"
                  sx={{ display: "flex", alignItems: "center", justifyContent: "space-between !important", width: "100%", padding: ".2rem .5rem" }}
                  {...props}
                  key={option.key}
                >
                  <div>{option.description}</div>
                </Box>
              );
            }}
          />

          <Box sx={{ display: "flex", alignItems: "center", margin: "0 .9rem" }}>
            <CustomTooltip
              arrow
              title={
                <div>
                  <div>{providerAttributesSchema[name].description}</div>

                  <div>Attribute key: {providerAttributesSchema[name].key}</div>
                </div>
              }
            >
              <InfoIcon color="disabled" fontSize="small" />
            </CustomTooltip>
          </Box>
        </Box>
      )}
    />
  );
};
