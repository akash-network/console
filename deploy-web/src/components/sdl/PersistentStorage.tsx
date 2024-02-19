"use client";
import { ReactNode } from "react";
import { RentGpusFormValues, SdlBuilderFormValues, Service } from "@src/types";
import { CustomTooltip } from "../shared/CustomTooltip";
import { FormPaper } from "./FormPaper";
import { Control, Controller } from "react-hook-form";
import { persistentStorageTypes, storageUnits } from "../shared/akash/units";
import { cn } from "@src/utils/styleUtils";
import { FormControl, FormDescription, FormItem } from "../ui/form";
import { InfoCircle } from "iconoir-react";
import { MdStorage } from "react-icons/md";
import { Checkbox } from "../ui/checkbox";
import { Input, InputWithIcon } from "../ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Slider } from "../ui/slider";

type Props = {
  currentService: Service;
  serviceIndex: number;
  children?: ReactNode;
  control: Control<SdlBuilderFormValues | RentGpusFormValues, any>;
};

// const useStyles = makeStyles()(theme => ({
//   formControl: {
//     marginBottom: theme.spacing(1.5)
//   },
//   textField: {
//     width: "100%"
//   }
// }));

export const PersistentStorage: React.FunctionComponent<Props> = ({ currentService, serviceIndex, control }) => {
  return (
    <FormPaper
      className={cn({ ["px-4 pb-4 pt-2"]: !!currentService.profile.hasPersistentStorage, ["px-4 py-2"]: !currentService.profile.hasPersistentStorage })}
      // sx={{ padding: currentService.profile.hasPersistentStorage ? ".5rem 1rem 1rem" : ".5rem 1rem" }}
    >
      <Controller
        control={control}
        name={`services.${serviceIndex}.profile.persistentStorage`}
        rules={{
          min: 1,
          validate: v => {
            if (!v) return "Storage amount is required.";
            return true;
          }
        }}
        render={({ field, fieldState }) => (
          <FormItem
          // className={cx(classes.formControl, classes.textField)}
          // variant="standard"
          // sx={{ marginBottom: "0 !important" }}
          // error={!!fieldState.error}
          >
            <div
              className="flex items-start justify-between sm:flex-row sm:items-center"
              // sx={{
              //   display: "flex",
              //   alignItems: { xs: "flex-start", sm: "center" },
              //   justifyContent: "space-between",
              //   flexDirection: { xs: "column", sm: "row" }
              // }}
            >
              <div className="flex items-center">
                <div className="flex items-center">
                  <MdStorage className="mr-2 text-muted-foreground" />
                  <strong>Persistent Storage</strong>

                  <CustomTooltip
                    title={
                      <>
                        The amount of persistent storage required for this workload.
                        <br />
                        <br />
                        This storage is mounted on a persistent volume and persistent through the lifetime of the deployment
                        <br />
                        <br />
                        <a href="https://docs.akash.network/features/persistent-storage" target="_blank" rel="noopener">
                          View official documentation.
                        </a>
                      </>
                    }
                  >
                    <InfoCircle className="ml-4 text-sm text-muted-foreground" />
                  </CustomTooltip>
                </div>

                <Controller
                  control={control}
                  name={`services.${serviceIndex}.profile.hasPersistentStorage`}
                  render={({ field }) => <Checkbox checked={field.value} onChange={field.onChange} className="ml-2" />}
                />
              </div>

              {currentService.profile.hasPersistentStorage && (
                <div
                  className="mt-2 sm:mt-0"
                  // sx={{ marginTop: { xs: ".5rem", sm: 0 } }}
                >
                  <Input
                    type="number"
                    // variant="outlined"
                    color="secondary"
                    value={field.value || ""}
                    // error={!!fieldState.error}
                    onChange={event => field.onChange(parseFloat(event.target.value))}
                    // inputProps={{ min: 1, step: 1 }}
                    min={1}
                    step={1}
                    className="w-[100px]"
                    // size="small"
                    // sx={{ width: "100px" }}
                  />

                  <Controller
                    control={control}
                    name={`services.${serviceIndex}.profile.persistentStorageUnit`}
                    rules={{ required: "Storage unit is required." }}
                    defaultValue=""
                    render={({ field }) => (
                      <Select value={field.value || ""} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select unit" className="ml-1 w-[75px]" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {storageUnits.map(t => {
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
                      //   {storageUnits.map(u => (
                      //     <MenuItem key={u.id} value={u.suffix}>
                      //       {u.suffix}
                      //     </MenuItem>
                      //   ))}
                      // </Select>
                    )}
                  />
                </div>
              )}
            </div>

            {currentService.profile.hasPersistentStorage && (
              <Slider
                value={[field.value || 0]}
                min={1}
                max={512}
                step={1}
                // color="secondary"
                // aria-label="Persistent Storage"
                // valueLabelDisplay="auto"
                onValueChange={newValue => field.onChange(newValue)}
              />
            )}

            {!!fieldState.error && <FormDescription>{fieldState.error.message}</FormDescription>}
          </FormItem>
        )}
      />

      {currentService.profile.hasPersistentStorage && (
        <div>
          <div className="mt-4 flex items-start">
            <Controller
              control={control}
              name={`services.${serviceIndex}.profile.persistentStorageParam.name`}
              rules={{
                required: "Name is required.",
                validate: value => {
                  const hasValidChars = /^[a-z0-9\-]+$/.test(value);
                  const hasValidStartingChar = /^[a-z]/.test(value);
                  const hasValidEndingChar = !value.endsWith("-");

                  if (!hasValidChars) {
                    return "Invalid storage name. It must only be lower case letters, numbers and dashes.";
                  } else if (!hasValidStartingChar) {
                    return "Invalid starting character. It can only start with a lowercase letter.";
                  } else if (!hasValidEndingChar) {
                    return "Invalid ending character. It can only end with a lowercase letter or number";
                  }

                  return true;
                }
              }}
              render={({ field, fieldState }) => (
                <InputWithIcon
                  type="text"
                  // variant="outlined"
                  color="secondary"
                  label="Name"
                  value={field.value}
                  // error={!!fieldState.error}
                  error={fieldState.error?.message}
                  onChange={event => field.onChange(event.target.value)}
                  // size="small"
                  className="w-full"
                  // sx={{ width: "100%" }}
                  // helperText={!!fieldState.error && fieldState.error.message}
                  endIcon={
                    <CustomTooltip
                      title={
                        <>
                          The name of the persistent volume.
                          <br />
                          <br />
                          Multiple services can gain access to the same volume by name.
                        </>
                      }
                    >
                      <InfoCircle className="text-sm text-muted-foreground" />
                    </CustomTooltip>
                  }
                  // InputProps={{
                  //   endAdornment: (
                  //     <InputAdornment position="end">
                  //       <CustomTooltip
                  //         arrow
                  //         title={
                  //           <>
                  //             The name of the persistent volume.
                  //             <br />
                  //             <br />
                  //             Multiple services can gain access to the same volume by name.
                  //           </>
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
            <div className="ml-4 flex items-center">
              <p className="whitespace-nowrap">
                <strong>Read only</strong>
              </p>

              <Controller
                control={control}
                name={`services.${serviceIndex}.profile.persistentStorageParam.readOnly`}
                render={({ field }) => <Checkbox checked={field.value} onChange={field.onChange} className="ml-2" />}
              />
            </div>
          </div>
          <div className="mt-4 flex items-start">
            <Controller
              control={control}
              name={`services.${serviceIndex}.profile.persistentStorageParam.type`}
              render={({ field }) => (
                // <FormControl
                //   className="w-full basis-[40%]"
                //   // fullWidth sx={{ flexBasis: "40%" }}
                // >
                //   <InputLabel id={`persistent-storage-type-${currentService.id}`}>Type</InputLabel>
                //   <Select
                //     labelId={`persistent-storage-type-${currentService.id}`}
                //     value={field.value || ""}
                //     onChange={field.onChange}
                //     variant="outlined"
                //     size="small"
                //     sx={{ width: "100%" }}
                //     label="Type"
                //     MenuProps={{ disableScrollLock: true }}
                //   >
                //     {persistentStorageTypes.map(u => (
                //       <MenuItem key={u.id} value={u.className}>
                //         {u.name}
                //       </MenuItem>
                //     ))}
                //   </Select>
                // </FormControl>

                <FormItem
                  className="w-full basis-[40%]"
                  // fullWidth sx={{ flexBasis: "40%" }}
                >
                  <label>Token</label>
                  <Select value={field.value || ""} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select token" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {persistentStorageTypes.map(t => {
                          return (
                            <SelectItem key={t.id} value={t.className}>
                              {t.name}
                            </SelectItem>
                          );
                        })}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            <Controller
              control={control}
              name={`services.${serviceIndex}.profile.persistentStorageParam.mount`}
              rules={{ required: "Mount is required.", pattern: { value: /^\/.*$/, message: "Mount must be an absolute path." } }}
              render={({ field, fieldState }) => (
                <InputWithIcon
                  type="text"
                  // variant="outlined"
                  color="secondary"
                  label="Mount"
                  placeholder="Example: /mnt/data"
                  value={field.value}
                  error={fieldState.error?.message}
                  onChange={event => field.onChange(event.target.value)}
                  // size="small"
                  className="ml-2 w-full"
                  // sx={{ width: "100%", marginLeft: ".5rem" }}
                  // helperText={!!fieldState.error && fieldState.error.message}
                  endIcon={
                    <CustomTooltip
                      title={
                        <>
                          The path to mount the persistent volume to.
                          <br />
                          <br />
                          Example: /mnt/data
                        </>
                      }
                    >
                      <InfoCircle className="text-sm text-muted-foreground" />
                    </CustomTooltip>
                  }
                  // InputProps={{
                  //   endAdornment: (
                  //     <InputAdornment position="end">
                  //       <CustomTooltip
                  //         arrow
                  //         title={
                  //           <>
                  //             The path to mount the persistent volume to.
                  //             <br />
                  //             <br />
                  //             Example: /mnt/data
                  //           </>
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
          </div>
        </div>
      )}
    </FormPaper>
  );
};
