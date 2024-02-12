"use client";
import { ReactNode } from "react";
import { Control, Controller } from "react-hook-form";
import { SdlBuilderFormValues, Service } from "@src/types";
import InfoIcon from "@mui/icons-material/Info";
import { nextCases } from "@src/utils/sdl/data";
import { CardContent } from "@mui/material";
import { Card } from "../ui/card";
import { cn } from "@src/utils/styleUtils";
import { CustomTooltip } from "../shared/CustomTooltip";
import { InfoCircle } from "iconoir-react";
import { Checkbox } from "../ui/checkbox";
import { InputWithIcon } from "../ui/input";
import { Select } from "../ui/select";
import MultipleSelector from "../ui/multiple-selector";

type Props = {
  serviceIndex: number;
  exposeIndex: number;
  services: Service[];
  control: Control<SdlBuilderFormValues, any>;
  children?: ReactNode;
};

// const useStyles = makeStyles()(theme => ({
//   root: {
//     marginTop: "1rem",
//     padding: "1rem",
//     height: "100%",
//     display: "flex",
//     flexDirection: "column",
//     justifyContent: "space-between",
//     backgroundColor: theme.palette.mode === "dark" ? theme.palette.primary.dark : theme.palette.grey[300]
//   },
//   formControl: {
//     marginBottom: theme.spacing(1.5)
//   },
//   textField: {
//     width: "100%"
//   }
// }));

export const HttpOptionsFormControl: React.FunctionComponent<Props> = ({ control, serviceIndex, exposeIndex, services }) => {
  const currentService = services[serviceIndex];

  return (
    <Card className="mt-4 flex h-full flex-col justify-between bg-muted p-4">
      <CardContent>
        <div
          className={cn("flex items-center", { ["mb-8"]: !!currentService.expose[exposeIndex]?.hasCustomHttpOptions })}
          // sx={{ display: "flex", alignItems: "center", marginBottom: currentService.expose[exposeIndex]?.hasCustomHttpOptions ? "2rem" : 0 }}
        >
          <div className="flex items-center">
            <p>
              <strong>HTTP Options</strong>
            </p>

            <CustomTooltip
              title={
                <>
                  Akash deployment SDL services stanza definitions have been augmented to include “http_options” allowing granular specification of HTTP
                  endpoint parameters. Inclusion of the parameters in this section are optional but will afford detailed definitions of attributes such as
                  body/payload max size where necessary.
                  <br />
                  <br />
                  <a href="https://docs.akash.network/features/deployment-http-options" target="_blank" rel="noopener">
                    View official documentation.
                  </a>
                </>
              }
            >
              <InfoCircle className="ml-4" />
            </CustomTooltip>
          </div>

          <div className="ml-8 flex items-center">
            <Controller
              control={control}
              name={`services.${serviceIndex}.expose.${exposeIndex}.hasCustomHttpOptions`}
              render={({ field }) => (
                <div className="flex items-center space-x-2">
                  <Checkbox id={`custom-options-${serviceIndex}-${exposeIndex}`} checked={field.value} onChange={field.onChange} />
                  <label
                    htmlFor={`custom-options-${serviceIndex}-${exposeIndex}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Custom Options
                  </label>
                </div>
              )}
            />
          </div>
        </div>

        {currentService.expose[exposeIndex]?.hasCustomHttpOptions && (
          <>
            <Controller
              control={control}
              name={`services.${serviceIndex}.expose.${exposeIndex}.httpOptions.maxBodySize`}
              render={({ field, fieldState }) => (
                <InputWithIcon
                  type="number"
                  // variant="outlined"
                  label="Max Body Size"
                  color="secondary"
                  // fullWidth
                  value={field.value}
                  error={fieldState.error?.message}
                  // className={classes.formControl}
                  // size="small"
                  onChange={event => field.onChange(parseInt(event.target.value))}
                  endIcon={
                    <CustomTooltip title="Sets the maximum size of an individual HTTP request body.">
                      <InfoCircle className="text-muted-foreground" />
                    </CustomTooltip>
                  }
                  min={0}
                  // inputProps={{ min: 0 }}
                  // InputProps={{
                  //   endAdornment: (
                  //     <InputAdornment position="end">
                  //       <CustomTooltip arrow title="Sets the maximum size of an individual HTTP request body.">
                  //         <InfoIcon color="disabled" fontSize="small" />
                  //       </CustomTooltip>
                  //     </InputAdornment>
                  //   )
                  // }}
                />
              )}
            />

            <Controller
              control={control}
              name={`services.${serviceIndex}.expose.${exposeIndex}.httpOptions.readTimeout`}
              render={({ field, fieldState }) => (
                <InputWithIcon
                  type="number"
                  // variant="outlined"
                  label="Read Timeout"
                  color="secondary"
                  // fullWidth
                  value={field.value}
                  error={fieldState.error?.message}
                  // className={classes.formControl}
                  // size="small"
                  onChange={event => field.onChange(parseInt(event.target.value))}
                  min={0}
                  endIcon={
                    <CustomTooltip title="Duration the proxy will wait for a response from the service.">
                      <InfoCircle className="text-muted-foreground" />
                    </CustomTooltip>
                  }
                  // inputProps={{ min: 0 }}
                  // InputProps={{
                  //   endAdornment: (
                  //     <InputAdornment position="end">
                  //       <CustomTooltip arrow title="Duration the proxy will wait for a response from the service.">
                  //         <InfoIcon color="disabled" fontSize="small" />
                  //       </CustomTooltip>
                  //     </InputAdornment>
                  //   )
                  // }}
                />
              )}
            />

            <Controller
              control={control}
              name={`services.${serviceIndex}.expose.${exposeIndex}.httpOptions.sendTimeout`}
              render={({ field, fieldState }) => (
                <InputWithIcon
                  type="number"
                  // variant="outlined"
                  label="Send Timeout"
                  color="secondary"
                  // fullWidth
                  value={field.value}
                  error={fieldState.error?.message}
                  // className={classes.formControl}
                  // size="small"
                  onChange={event => field.onChange(parseInt(event.target.value))}
                  min={0}
                  endIcon={
                    <CustomTooltip title="Duration the proxy will wait for the service to accept a request.">
                      <InfoCircle className="text-muted-foreground" />
                    </CustomTooltip>
                  }
                  // inputProps={{ min: 0 }}
                  // InputProps={{
                  //   endAdornment: (
                  //     <InputAdornment position="end">
                  //       <CustomTooltip arrow title="Duration the proxy will wait for the service to accept a request.">
                  //         <InfoIcon color="disabled" fontSize="small" />
                  //       </CustomTooltip>
                  //     </InputAdornment>
                  //   )
                  // }}
                />
              )}
            />

            <Controller
              control={control}
              name={`services.${serviceIndex}.expose.${exposeIndex}.httpOptions.nextTries`}
              render={({ field, fieldState }) => (
                <InputWithIcon
                  type="number"
                  // variant="outlined"
                  label="Next Tries"
                  color="secondary"
                  // fullWidth
                  value={field.value}
                  error={fieldState.error?.message}
                  // className={classes.formControl}
                  // size="small"
                  onChange={event => field.onChange(parseInt(event.target.value))}
                  min={0}
                  endIcon={
                    <CustomTooltip title="Number of attempts the proxy will attempt another replica.">
                      <InfoCircle className="text-muted-foreground" />
                    </CustomTooltip>
                  }
                  // inputProps={{ min: 0 }}
                  // InputProps={{
                  //   endAdornment: (
                  //     <InputAdornment position="end">
                  //       <CustomTooltip arrow title="Number of attempts the proxy will attempt another replica.">
                  //         <InfoIcon color="disabled" fontSize="small" />
                  //       </CustomTooltip>
                  //     </InputAdornment>
                  //   )
                  // }}
                />
              )}
            />

            <Controller
              control={control}
              name={`services.${serviceIndex}.expose.${exposeIndex}.httpOptions.nextTimeout`}
              render={({ field, fieldState }) => (
                <InputWithIcon
                  type="number"
                  // variant="outlined"
                  label="Next Timeout"
                  color="secondary"
                  // fullWidth
                  value={field.value}
                  error={fieldState.error?.message}
                  // className={classes.formControl}
                  // size="small"
                  onChange={event => field.onChange(parseInt(event.target.value))}
                  min={0}
                  endIcon={
                    <CustomTooltip title="Duration the proxy will wait for the service to connect to another replica.">
                      <InfoCircle className="text-muted-foreground" />
                    </CustomTooltip>
                  }
                  // inputProps={{ min: 0 }}
                  // InputProps={{
                  //   endAdornment: (
                  //     <InputAdornment position="end">
                  //       <CustomTooltip arrow title="Duration the proxy will wait for the service to connect to another replica.">
                  //         <InfoIcon color="disabled" fontSize="small" />
                  //       </CustomTooltip>
                  //     </InputAdornment>
                  //   )
                  // }}
                />
              )}
            />

            <Controller
              control={control}
              name={`services.${serviceIndex}.expose.${exposeIndex}.httpOptions.nextCases`}
              defaultValue={[]}
              render={({ field }) => (
                <MultipleSelector
                  value={field.value.map(v => ({ value: v, label: v })) || []}
                  // defaultOptions={nextCases}
                  options={nextCases}
                  hidePlaceholderWhenSelected
                  placeholder="Select Next Cases"

                  // emptyIndicator={
                  //   <p className="text-center text-lg leading-10 text-gray-600 dark:text-gray-400">
                  //     no results found.
                  //   </p>
                  // }
                />
              )}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
};
