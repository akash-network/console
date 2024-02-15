"use client";
import { ReactNode } from "react";
import { RentGpusFormValues, SdlBuilderFormValues, Service } from "@src/types";
import { CustomTooltip } from "../shared/CustomTooltip";
import { FormPaper } from "./FormPaper";
import { Control, Controller } from "react-hook-form";
import { validationConfig, memoryUnits } from "../shared/akash/units";
import { FormControl, FormDescription } from "../ui/form";
import { Slider } from "../ui/slider";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Input } from "../ui/input";
import { InfoCircle } from "iconoir-react";
import { MdMemory } from "react-icons/md";
import { cn } from "@src/utils/styleUtils";

type Props = {
  serviceIndex: number;
  children?: ReactNode;
  control: Control<SdlBuilderFormValues | RentGpusFormValues, any>;
  currentService: Service;
};

// const useStyles = makeStyles()(theme => ({
//   formControl: {
//     marginBottom: theme.spacing(1.5)
//   },
//   textField: {
//     width: "100%"
//   }
// }));

export const MemoryFormControl: React.FunctionComponent<Props> = ({ control, serviceIndex, currentService }) => {
  return (
    <Controller
      control={control}
      name={`services.${serviceIndex}.profile.ram`}
      rules={{
        validate: v => {
          if (!v) return "Memory amount is required.";

          const currentUnit = memoryUnits.find(u => currentService.profile.ramUnit === u.suffix);
          const _value = (v || 0) * (currentUnit?.value || 0);

          if (currentService.count === 1 && _value < validationConfig.minMemory) {
            return "Minimum amount of memory for a single service instance is 1 Mi.";
          } else if (currentService.count === 1 && currentService.count * _value > validationConfig.maxMemory) {
            return "Maximum amount of memory for a single service instance is 512 Gi.";
          } else if (currentService.count > 1 && currentService.count * _value > validationConfig.maxGroupMemory) {
            return "Maximum total amount of memory for a single service instance group is 1024 Gi.";
          }

          return true;
        }
      }}
      render={({ field, fieldState }) => (
        <FormPaper
          className={cn("px-2 py-4", { ["border-b border-red-500"]: !!fieldState.error })}
          // sx={{ padding: ".5rem 1rem", borderBottom: !!fieldState.error && `1px solid ${theme.palette.error.main}` }}
        >
          <FormControl
          // className={cx(classes.formControl, classes.textField)}
          // variant="standard"
          // sx={{ marginBottom: "0 !important" }}
          // error={!!fieldState.error}
          >
            <div
              className="flex flex-col items-start sm:flex-row sm:items-center"
              // sx={{
              //   display: "flex",
              //   alignItems: { xs: "flex-start", sm: "center" },
              //   flexDirection: { xs: "column", sm: "row" }
              // }}
            >
              <div className="flex items-center">
                <MdMemory className="mr-2 text-muted-foreground" fontSize="medium" />
                <strong>Memory</strong>

                <CustomTooltip
                  title={
                    <>
                      The amount of memory required for this workload.
                      <br />
                      <br />
                      The maximum for a single instance is 512 Gi.
                      <br />
                      <br />
                      The maximum total multiplied by the count of instances is 1024 Gi.
                    </>
                  }
                >
                  <InfoCircle className="ml-4 text-sm text-muted-foreground" />
                </CustomTooltip>
              </div>

              <div
                className="mt-2 sm:ml-4 sm:mt-0"
                // sx={{ marginTop: { xs: ".5rem", sm: 0 }, marginLeft: { xs: 0, sm: "1rem" } }}
              >
                <Input
                  type="number"
                  // variant="outlined"
                  // error={!!fieldState.error}
                  color="secondary"
                  value={field.value || ""}
                  onChange={event => field.onChange(parseFloat(event.target.value))}
                  // inputProps={{ min: 1, step: 1 }}
                  min={1}
                  step={1}
                  // size="small"
                  className="w-[100px]"
                  // sx={{ width: "100px" }}
                />

                <Controller
                  control={control}
                  name={`services.${serviceIndex}.profile.ramUnit`}
                  rules={{ required: "Ram unit is required." }}
                  defaultValue=""
                  render={({ field }) => (
                    <Select value={field.value || ""} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select unit" className="ml-1 w-[75px]" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {memoryUnits.map(t => {
                            return (
                              <SelectItem key={t.id} value={t.suffix}>
                                {t.suffix}
                              </SelectItem>
                            );
                          })}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    // <Select
                    //   value={field.value || ""}
                    //   onChange={field.onChange}
                    //   variant="outlined"
                    //   size="small"
                    //   sx={{ width: "75px", marginLeft: ".25rem" }}
                    //   MenuProps={{ disableScrollLock: true }}
                    // >
                    //   {memoryUnits.map(u => (
                    //     <MenuItem key={u.id} value={u.suffix}>
                    //       {u.suffix}
                    //     </MenuItem>
                    //   ))}
                    // </Select>
                  )}
                />
              </div>
            </div>

            <Slider
              value={[field.value || 0]}
              min={1}
              max={512}
              step={1}
              color="secondary"
              aria-label="RAM"
              // valueLabelDisplay="auto"
              onValueChange={newValue => field.onChange(newValue)}
            />

            {!!fieldState.error && <FormDescription>{fieldState.error.message}</FormDescription>}
          </FormControl>
        </FormPaper>
      )}
    />
  );
};
