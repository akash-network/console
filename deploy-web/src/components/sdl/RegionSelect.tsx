import { Autocomplete, Box, ClickAwayListener, TextField } from "@mui/material";
import { RentGpusFormValues } from "@src/types";
import { ProviderAttributeSchemaDetailValue, ProviderAttributesSchema } from "@src/types/providerAttributes";
import { useState } from "react";
import { Control, Controller, FieldPath } from "react-hook-form";
import { CustomTooltip } from "../shared/CustomTooltip";
import InfoIcon from "@mui/icons-material/Info";

type RegionSelectProps = {
  control: Control<RentGpusFormValues, any>;
  providerAttributesSchema: ProviderAttributesSchema;
  className?: string;
};

export const RegionSelect: React.FunctionComponent<RegionSelectProps> = ({ control, providerAttributesSchema, className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const options = providerAttributesSchema?.["location-region"]?.values || [];

  console.log(options);

  return (
    <Controller
      control={control}
      name={`region`}
      render={({ field, fieldState }) => (
        <Box sx={{ display: "flex", alignItems: "center" }} className={className}>
          <Autocomplete
            disableClearable
            open={isOpen}
            options={options}
            value={field.value}
            getOptionLabel={option => option?.key}
            defaultValue={null}
            isOptionEqualToValue={(option, value) => option.key === value.key}
            filterSelectedOptions
            fullWidth
            ChipProps={{ size: "small" }}
            onChange={(event, newValue: ProviderAttributeSchemaDetailValue) => {
              field.onChange(newValue);
            }}
            renderInput={params => (
              <ClickAwayListener onClickAway={() => setIsOpen(false)}>
                <TextField
                  {...params}
                  label="Region"
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
                  <div>
                    {option.key}

                    <CustomTooltip arrow title={option.description}>
                      <InfoIcon color="disabled" fontSize="small" sx={{ marginLeft: ".5rem" }} />
                    </CustomTooltip>
                  </div>
                </Box>
              );
            }}
          />
        </Box>
      )}
    />
  );
};
