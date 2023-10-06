import { ReactNode, useRef } from "react";
import { makeStyles } from "tss-react/mui";
import { Popup } from "../shared/Popup";
import { Control, Controller } from "react-hook-form";
import { Box, FormControl, Grid, InputAdornment, InputLabel, MenuItem, Select, TextField, useTheme } from "@mui/material";
import { Placement, SdlBuilderFormValues, Service } from "@src/types";
import { FormPaper } from "./FormPaper";
import { SignedByFormControl, SignedByRefType } from "./SignedByFormControl";
import { AttributesFormControl, AttributesRefType } from "./AttributesFormControl";
import { CustomTooltip } from "../shared/CustomTooltip";
import InfoIcon from "@mui/icons-material/Info";
import { PriceValue } from "../shared/PriceValue";
import { getAvgCostPerMonth } from "@src/utils/priceUtils";
import { uAktDenom } from "@src/utils/constants";
import { useSdlDenoms } from "@src/hooks/useDenom";
import { FormattedNumber } from "react-intl";
import { USDLabel } from "../shared/UsdLabel";
import { udenomToDenom } from "@src/utils/mathHelpers";

type Props = {
  open: boolean;
  serviceIndex: number;
  services: Service[];
  onClose: () => void;
  control: Control<SdlBuilderFormValues, any>;
  children?: ReactNode;
  placement: Placement;
};

const useStyles = makeStyles()(theme => ({
  formControl: {
    marginBottom: theme.spacing(1.5)
  },
  textField: {
    width: "100%"
  }
}));

export const PlacementFormModal: React.FunctionComponent<Props> = ({ open, control, services, serviceIndex, onClose, placement: _placement }) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const signedByRef = useRef<SignedByRefType>();
  const attritubesRef = useRef<AttributesRefType>();
  const supportedSdlDenoms = useSdlDenoms();
  const currentService = services[serviceIndex];
  const selectedDenom = supportedSdlDenoms.find(x => x.value === currentService.placement.pricing.denom);

  const _onClose = () => {
    const attributesToRemove = [];
    const signedByAnyToRemove = [];
    const signedByAllToRemove = [];

    _placement.attributes.forEach((e, i) => {
      if (!e.key.trim() || !e.value.trim()) {
        attributesToRemove.push(i);
      }
    });

    _placement.signedBy.anyOf.forEach((e, i) => {
      if (!e.value.trim()) {
        signedByAnyToRemove.push(i);
      }
    });

    _placement.signedBy.allOf.forEach((e, i) => {
      if (!e.value.trim()) {
        signedByAllToRemove.push(i);
      }
    });

    attritubesRef.current?._removeAttribute(attributesToRemove);
    signedByRef.current?._removeSignedByAnyOf(signedByAnyToRemove);
    signedByRef.current?._removeSignedByAllOf(signedByAllToRemove);

    onClose();
  };

  return (
    <Popup
      fullWidth
      open={open}
      variant="custom"
      title="Edit placement"
      actions={[
        {
          label: "Close",
          color: "primary",
          variant: "text",
          side: "right",
          onClick: _onClose
        }
      ]}
      onClose={_onClose}
      maxWidth="md"
      enableCloseOnBackdropClick
    >
      <FormPaper
        elevation={2}
        sx={{
          display: "flex",
          padding: "1rem",
          paddingBottom: "2rem"
        }}
      >
        <Box sx={{ flexGrow: 1 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Controller
                control={control}
                name={`services.${serviceIndex}.placement.name`}
                rules={{
                  required: "Placement name is required",
                  validate: value => {
                    const hasValidChars = /^[a-z0-9\-]+$/.test(value);
                    const hasValidStartingChar = /^[a-z]/.test(value);
                    const hasValidEndingChar = !value.endsWith("-");

                    if (!hasValidChars) {
                      return "Invalid name. It must only be lower case letters, numbers and dashes.";
                    } else if (!hasValidStartingChar) {
                      return "Invalid starting character. It can only start with a lowercase letter.";
                    } else if (!hasValidEndingChar) {
                      return "Invalid ending character. It can only end with a lowercase letter or number";
                    }

                    return true;
                  }
                }}
                render={({ field, fieldState }) => (
                  <TextField
                    type="text"
                    variant="outlined"
                    label="Name"
                    fullWidth
                    value={field.value}
                    error={!!fieldState.error}
                    size="small"
                    onChange={event => field.onChange(event.target.value)}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <CustomTooltip arrow title={<>The name of the placement.</>}>
                            <InfoIcon color="disabled" fontSize="small" />
                          </CustomTooltip>
                        </InputAdornment>
                      )
                    }}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl className={classes.formControl} fullWidth sx={{ display: "flex", alignItems: "center", flexDirection: "row" }}>
                <InputLabel id="grant-token">Token</InputLabel>
                <Controller
                  control={control}
                  name={`services.${serviceIndex}.placement.pricing.denom`}
                  defaultValue=""
                  rules={{
                    required: true
                  }}
                  render={({ fieldState, field }) => {
                    return (
                      <Select {...field} labelId="sdl-token" label="Token" size="small" error={!!fieldState.error}>
                        {supportedSdlDenoms.map(token => (
                          <MenuItem key={token.id} value={token.value}>
                            {token.label}
                          </MenuItem>
                        ))}
                      </Select>
                    );
                  }}
                />

                <Box sx={{ display: "flex", alignItems: "center", flexGrow: 1, marginLeft: ".5rem" }}>
                  <Controller
                    control={control}
                    name={`services.${serviceIndex}.placement.pricing.amount`}
                    rules={{ required: "Pricing is required" }}
                    render={({ field, fieldState }) => (
                      <TextField
                        type="number"
                        variant="outlined"
                        label="Pricing"
                        fullWidth
                        value={field.value}
                        error={!!fieldState.error}
                        size="small"
                        inputProps={{ min: 1, step: 1, max: 10000000 }}
                        onChange={event => field.onChange(parseFloat(event.target.value))}
                      />
                    )}
                  />
                  <CustomTooltip
                    arrow
                    title={
                      <>
                        The maximum amount of {selectedDenom?.label} you're willing to pay per block (~6 seconds).
                        <br />
                        <br />
                        Akash will only show providers costing <strong>less</strong> than{" "}
                        <strong>
                          {selectedDenom?.value === uAktDenom ? (
                            <>
                              ~<PriceValue denom={uAktDenom} value={getAvgCostPerMonth(_placement.pricing.amount)} />
                            </>
                          ) : (
                            <>
                              <span>
                                <FormattedNumber value={udenomToDenom(getAvgCostPerMonth(_placement.pricing.amount))} maximumFractionDigits={2} />
                              </span>
                              <USDLabel />
                            </>
                          )}
                        </strong>
                        &nbsp;per month
                      </>
                    }
                  >
                    <InfoIcon color="disabled" fontSize="small" sx={{ marginLeft: "1rem" }} />
                  </CustomTooltip>
                </Box>
              </FormControl>
            </Grid>
          </Grid>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <SignedByFormControl
                control={control}
                serviceIndex={serviceIndex}
                signedByAnyOf={_placement.signedBy?.anyOf}
                signedByAllOf={_placement.signedBy?.allOf}
                ref={signedByRef}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <AttributesFormControl control={control} serviceIndex={serviceIndex} attributes={_placement.attributes} ref={attritubesRef} />
            </Grid>
          </Grid>
        </Box>
      </FormPaper>
    </Popup>
  );
};
