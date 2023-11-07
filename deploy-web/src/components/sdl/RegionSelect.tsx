import { Autocomplete, Box, ClickAwayListener, TextField, useTheme } from "@mui/material";
import { RentGpusFormValues } from "@src/types";
import { ProviderAttributeSchemaDetailValue, ProviderAttributesSchema, ProviderRegionValue } from "@src/types/providerAttributes";
import { useState } from "react";
import { Control, Controller } from "react-hook-form";
import { CustomTooltip } from "../shared/CustomTooltip";
import InfoIcon from "@mui/icons-material/Info";
import { useProviderRegions } from "@src/queries/useProvidersQuery";
import { makeStyles } from "tss-react/mui";
import { cx } from "@emotion/css";

type RegionSelectProps = {
  control: Control<RentGpusFormValues, any>;
  className?: string;
};

const useStyles = makeStyles()(theme => ({
  disabled: {
    color: theme.palette.mode === "dark" ? theme.palette.grey[600] : theme.palette.grey[400],
    pointerEvents: "none",
    cursor: "default"
  }
}));

export const RegionSelect: React.FunctionComponent<RegionSelectProps> = ({ control, className }) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const { data: regions, isLoading: isLoadingRegions } = useProviderRegions();
  const options = [
    {
      key: "any",
      description: "Any region",
      providers: []
    },
    ...(regions || [])
  ];

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
            value={field.value as ProviderRegionValue}
            getOptionLabel={option => option?.key}
            defaultValue={null}
            isOptionEqualToValue={(option, value) => option.key === value.key}
            filterSelectedOptions
            fullWidth
            loading={isLoadingRegions}
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
                  {...props}
                  component="li"
                  sx={{ display: "flex", alignItems: "center", width: "100%", padding: ".2rem .5rem" }}
                  className={cx({ [classes.disabled]: option.key !== "any" && option.providers?.length === 0 }, props.className)}
                >
                  <span>{option.key}</span>
                  {option.key !== "any" && (
                    <Box
                      component="small"
                      sx={{
                        marginLeft: ".5rem",
                        color: option.providers?.length === 0 ? "inherit" : theme.palette.secondary.main,
                        fontWeight: option.providers?.length > 0 ? "bold" : "normal"
                      }}
                    >
                      ({option.providers.length})
                    </Box>
                  )}
                  <CustomTooltip arrow title={option.description}>
                    <InfoIcon color="disabled" fontSize="small" sx={{ marginLeft: ".5rem" }} />
                  </CustomTooltip>
                </Box>
              );
            }}
          />
        </Box>
      )}
    />
  );
};
