import { Autocomplete, Box, ClickAwayListener, TextField } from "@mui/material";
import { RentGpusFormValues, SdlBuilderFormValues } from "@src/types";
import { ProviderAttributeSchemaDetailValue, ProviderAttributesSchema } from "@src/types/providerAttributes";
import { useState } from "react";
import { Control, Controller, FieldPath } from "react-hook-form";

type FormSelectProps = {
  control: Control<any, any>;
  providerAttributesSchema: ProviderAttributesSchema;
  optionName?: keyof ProviderAttributesSchema;
  name: FieldPath<SdlBuilderFormValues | RentGpusFormValues>;
  className?: string;
  requiredMessage?: string;
  label: string;
  multiple?: boolean;
  required?: boolean;
  disabled?: boolean;
  valueType?: "key" | "description ";
};

export const FormSelect: React.FunctionComponent<FormSelectProps> = ({
  control,
  providerAttributesSchema,
  optionName,
  name,
  className,
  requiredMessage,
  label,
  required = providerAttributesSchema[optionName]?.required || false,
  multiple,
  disabled,
  valueType = "description"
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const options = providerAttributesSchema[optionName]?.values || [];

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
            disabled={disabled}
            options={options}
            value={field.value || (multiple ? ([] as any) : null)}
            getOptionLabel={option => (valueType === "key" ? option?.key : option?.description) || ""}
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
                  <div>{valueType === "key" ? option.key : option.description}</div>
                </Box>
              );
            }}
          />
        </Box>
      )}
    />
  );
};
