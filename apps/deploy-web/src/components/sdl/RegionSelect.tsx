"use client";
import { useState } from "react";
import { Control, Controller } from "react-hook-form";
import { CustomTooltip } from "@akashnetwork/ui/components";
import Autocomplete from "@mui/material/Autocomplete";
import ClickAwayListener from "@mui/material/ClickAwayListener";
import TextField from "@mui/material/TextField";
import { InfoCircle } from "iconoir-react";

import { useProviderRegions } from "@src/queries/useProvidersQuery";
import { RentGpusFormValues } from "@src/types";
import { ProviderAttributeSchemaDetailValue, ProviderRegionValue } from "@src/types/providerAttributes";
import { cn } from "@src/utils/styleUtils";

type RegionSelectProps = {
  control: Control<RentGpusFormValues, any>;
  className?: string;
};

export const RegionSelect: React.FunctionComponent<RegionSelectProps> = ({ control, className }) => {
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
        <div className={cn(className, "flex items-center")}>
          <Autocomplete
            disableClearable
            open={isOpen}
            options={options}
            value={field.value as ProviderRegionValue}
            getOptionLabel={option => option?.key}
            defaultValue={undefined}
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
                <li
                  {...props}
                  className={cn(
                    "flex w-full items-center px-2 py-1",
                    { ["pointer-events-none cursor-default text-muted"]: option.key !== "any" && option.providers?.length === 0 },
                    props.className
                  )}
                >
                  <span>{option.key}</span>
                  {option.key !== "any" && (
                    <small
                      className={cn("ml-2", { ["font-bold text-primary"]: option.providers?.length > 0 })}
                      // sx={{
                      //   marginLeft: ".5rem",
                      //   color: option.providers?.length === 0 ? "inherit" : theme.palette.secondary.main,
                      //   fontWeight: option.providers?.length > 0 ? "bold" : "normal"
                      // }}
                    >
                      ({option.providers.length})
                    </small>
                  )}
                  <CustomTooltip title={option.description}>
                    <InfoCircle className="ml-2 text-xs text-muted-foreground" />
                  </CustomTooltip>
                </li>
              );
            }}
          />
        </div>
      )}
    />
  );
};
