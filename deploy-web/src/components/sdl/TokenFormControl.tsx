import { ReactElement } from "react";
import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";
import { makeStyles } from "tss-react/mui";
import { Control, Controller, Path } from "react-hook-form";
import { FieldValues } from "react-hook-form/dist/types/fields";
import { FieldPathValue } from "react-hook-form/dist/types";

import { Service } from "@src/types";
import { useSdlDenoms } from "@src/hooks/useDenom";

interface ServicesFieldValues extends FieldValues {
  services: Service[];
}

interface Props<TFieldValues extends ServicesFieldValues, TName extends Path<TFieldValues> = Path<TFieldValues>> {
  name: TName;
  defaultValue?: FieldPathValue<TFieldValues, TName>;
  control: Control<TFieldValues>;
}

const useStyles = makeStyles()(theme => ({
  formControl: {
    marginBottom: theme.spacing(1.5)
  }
}));

export const TokenFormControl = <F extends ServicesFieldValues>({ control, name, defaultValue }: Props<F>): ReactElement<Props<F>> => {
  const { classes } = useStyles();
  const supportedSdlDenoms = useSdlDenoms();

  return (
    <FormControl className={classes.formControl} fullWidth sx={{ display: "flex", alignItems: "center", flexDirection: "row" }}>
      <InputLabel id="grant-token">Token</InputLabel>
      <Controller
        control={control}
        name={name}
        defaultValue={defaultValue}
        rules={{
          required: true
        }}
        render={({ fieldState, field }) => {
          return (
            <Select {...field} labelId="sdl-token" label="Token" size="small" error={!!fieldState.error} fullWidth MenuProps={{ disableScrollLock: true }}>
              {supportedSdlDenoms.map(token => (
                <MenuItem key={token.id} value={token.value}>
                  {token.tokenLabel}
                </MenuItem>
              ))}
            </Select>
          );
        }}
      />
    </FormControl>
  );
};
