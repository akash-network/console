"use client";
import { Controller, Control, UseFormTrigger } from "react-hook-form";
import { Dispatch, SetStateAction, useState } from "react";
import { SdlBuilderFormValues, Service } from "@src/types";
import { CommandFormModal } from "./CommandFormModal";
import { EnvFormModal } from "./EnvFormModal";
import { ExposeFormModal } from "./ExposeFormModal";
import { FormPaper } from "./FormPaper";
import { LeaseSpecDetail } from "../shared/LeaseSpecDetail";
import { PlacementFormModal } from "./PlacementFormModal";
import { udenomToDenom } from "@src/utils/mathHelpers";
import Link from "next/link";
import { PriceValue } from "../shared/PriceValue";
import { getAvgCostPerMonth, toReadableDenom } from "@src/utils/priceUtils";
import Image from "next/legacy/image";
import { uAktDenom } from "@src/utils/constants";
import { EnvVarList } from "./EnvVarList";
import { CommandList } from "./CommandList";
import { ExposeList } from "./ExposeList";
import { PersistentStorage } from "./PersistentStorage";
import { GpuFormControl } from "./GpuFormControl";
import { CpuFormControl } from "./CpuFormControl";
import { MemoryFormControl } from "./MemoryFormControl";
import { StorageFormControl } from "./StorageFormControl";
import { TokenFormControl } from "./TokenFormControl";
import { GpuVendor } from "@src/types/gpu";
import { useMediaQuery } from "usehooks-ts";
import { breakpoints } from "@src/utils/responsiveUtils";
import { Card, CardContent } from "../ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { Button, buttonVariants } from "../ui/button";
import { NavArrowDown, Bin, InfoCircle, OpenInWindow } from "iconoir-react";
import { cn } from "@src/utils/styleUtils";
import { InputWithIcon } from "../ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

type Props = {
  _services: Service[];
  serviceIndex: number;
  control: Control<SdlBuilderFormValues, any>;
  trigger: UseFormTrigger<SdlBuilderFormValues>;
  onRemoveService: (index: number) => void;
  serviceCollapsed: number[];
  setServiceCollapsed: Dispatch<SetStateAction<number[]>>;
  setValue: UseFormSetValue<SdlBuilderFormValues>;
  gpuModels: GpuVendor[];
};

// const useStyles = makeStyles()(theme => ({
//   formControl: {
//     marginBottom: theme.spacing(1.5)
//   },
//   textField: {
//     width: "100%"
//   },
//   serviceBox: {
//     marginTop: "1rem",
//     border: `1px solid ${theme.palette.mode === "dark" ? theme.palette.grey[900] : theme.palette.grey[100]}`,
//     borderRadius: ".5rem"
//   },
//   editLink: {
//     color: theme.palette.secondary.light,
//     textDecoration: "underline",
//     cursor: "pointer",
//     fontWeight: "normal",
//     fontSize: ".8rem"
//   },
//   formValue: {
//     color: theme.palette.grey[500]
//   }
// }));

export const SimpleServiceFormControl: React.FunctionComponent<Props> = ({
  serviceIndex,
  control,
  _services,
  onRemoveService,
  trigger,
  serviceCollapsed,
  setServiceCollapsed,
  setValue,
  gpuModels
}) => {
  const [isEditingCommands, setIsEditingCommands] = useState<number | boolean | null>(null);
  const [isEditingEnv, setIsEditingEnv] = useState<number | boolean | null>(null);
  const [isEditingExpose, setIsEditingExpose] = useState<number | boolean | null>(null);
  const [isEditingPlacement, setIsEditingPlacement] = useState<number | boolean | null>(null);
  // TODO
  const isDesktop = useMediaQuery(breakpoints.md.mediaQuery);
  const expanded = !serviceCollapsed.some(x => x === serviceIndex);
  const currentService: Service = _services[serviceIndex] || ({} as any);
  const _isEditingEnv = serviceIndex === isEditingEnv;
  const _isEditingCommands = serviceIndex === isEditingCommands;
  const _isEditingExpose = serviceIndex === isEditingExpose;
  const _isEditingPlacement = serviceIndex === isEditingPlacement;

  const onExpandClick = () => {
    setServiceCollapsed(prev => {
      if (expanded) {
        return prev.concat([serviceIndex]);
      } else {
        return prev.filter(x => x !== serviceIndex);
      }
    });
  };

  return (
    <Collapsible open={expanded} onOpenChange={onExpandClick}>
      <Card className="mt-4 rounded-sm border border-muted-foreground/20">
        <CardContent>
          {/** Edit Environment Variables */}
          {_isEditingEnv && (
            <EnvFormModal control={control} onClose={() => setIsEditingEnv(null)} serviceIndex={serviceIndex} envs={currentService.env || []} />
          )}
          {/** Edit Commands */}
          {_isEditingCommands && <CommandFormModal control={control} onClose={() => setIsEditingCommands(null)} serviceIndex={serviceIndex} />}
          {/** Edit Expose */}
          {_isEditingExpose && (
            <ExposeFormModal
              control={control}
              onClose={() => setIsEditingExpose(null)}
              serviceIndex={serviceIndex}
              expose={currentService.expose}
              services={_services}
            />
          )}
          {/** Edit Placement */}
          {_isEditingPlacement && (
            <PlacementFormModal
              control={control}
              onClose={() => setIsEditingPlacement(null)}
              serviceIndex={serviceIndex}
              services={_services}
              placement={currentService.placement}
            />
          )}

          <div
            className="flex items-center justify-between border-b border-muted-foreground/20 p-4"
            // sx={{
            //   padding: "1rem",
            //   borderBottom: expanded ? `1px solid ${theme.palette.mode === "dark" ? theme.palette.grey[800] : theme.palette.grey[200]}` : "none",
            //   display: "flex",
            //   alignItems: "center",
            //   justifyContent: "space-between"
            // }}
          >
            <Controller
              control={control}
              name={`services.${serviceIndex}.title`}
              rules={{
                required: "Service name is required.",
                validate: value => {
                  const hasValidChars = /^[a-z0-9\-]+$/.test(value);
                  const hasValidStartingChar = /^[a-z]/.test(value);
                  const hasValidEndingChar = !value.endsWith("-");

                  if (!hasValidChars) {
                    return "Invalid service name. It must only be lower case letters, numbers and dashes.";
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
                  label="Service Name"
                  color="secondary"
                  // errorMessage={!!fieldState.error}
                  // helperText={fieldState.error?.message}
                  error={fieldState.error?.message}
                  // fullWidth
                  value={field.value}
                  // size="small"
                  onChange={event => field.onChange((event.target.value || "").toLowerCase())}
                  endIcon={
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <InfoCircle className="text-muted-foreground" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <>
                          The service name serves as a identifier for the workload to be ran on the Akash Network.
                          <br />
                          <br />
                          <a href="https://docs.akash.network/readme/stack-definition-language#services" target="_blank" rel="noopener">
                            View official documentation.
                          </a>
                        </>
                      </TooltipContent>
                    </Tooltip>
                  }
                />
              )}
            />

            <div className="ml-4 flex items-center">
              {!expanded && isDesktop && (
                <div className="flex items-center whitespace-nowrap">
                  <LeaseSpecDetail type="cpu" value={currentService.profile.cpu} />
                  <LeaseSpecDetail type="ram" className="ml-4" value={`${currentService.profile.ram} ${currentService.profile.ramUnit}`} />
                  <LeaseSpecDetail type="storage" className="ml-4" value={`${currentService.profile.storage} ${currentService.profile.storageUnit}`} />
                </div>
              )}
              {_services.length > 1 && (
                <Button size="icon" className="ml-2" onClick={() => onRemoveService(serviceIndex)}>
                  <Bin />
                </Button>
              )}

              {/* <ExpandMoreButton expand={expanded} onClick={onExpandClick} aria-expanded={expanded} aria-label="show more" sx={{ marginLeft: ".5rem" }}>
                <ExpandMoreIcon />
              </ExpandMoreButton> */}

              <CollapsibleTrigger asChild>
                <Button size="icon" variant="ghost" className="ml-2 rounded-full" onClick={onExpandClick}>
                  <NavArrowDown fontSize="1rem" className={cn("transition-all duration-100", { ["rotate-180"]: expanded })} />
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>

          <CollapsibleContent>
            <div className="p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="grid gap-4">
                    <div>
                      <div className="flex items-center">
                        <Controller
                          control={control}
                          name={`services.${serviceIndex}.image`}
                          rules={{
                            required: "Docker image name is required.",
                            validate: value => {
                              const hasValidChars = /^[a-z0-9\-_/:.]+$/.test(value);

                              if (!hasValidChars) {
                                return "Invalid docker image name.";
                              }

                              return true;
                            }
                          }}
                          render={({ field, fieldState }) => (
                            <InputWithIcon
                              type="text"
                              // variant="outlined"
                              label={`Docker Image / OS`}
                              placeholder="Example: mydockerimage:1.01"
                              color="secondary"
                              // error={!!fieldState.error}
                              error={fieldState.error?.message}
                              // fullWidth
                              // size="small"
                              value={field.value}
                              onChange={event => field.onChange((event.target.value || "").toLowerCase())}
                              startIcon={<Image alt="Docker Logo" src="/images/docker.png" layout="fixed" quality={100} width={24} height={18} priority />}
                              endIcon={
                                <Link
                                  href={`https://hub.docker.com/search?q=${currentService.image?.split(":")[0]}&type=image`}
                                  className={buttonVariants({ variant: "default", size: "icon" })}
                                  target="_blank"
                                >
                                  <OpenInWindow />
                                </Link>
                              }
                              // InputProps={{
                              //   startAdornment: (
                              //     <InputAdornment position="start">
                              //       <Image alt="Docker Logo" src="/images/docker.png" layout="fixed" quality={100} width={24} height={18} priority />
                              //     </InputAdornment>
                              //   ),
                              //   endAdornment: (
                              //     <InputAdornment position="end">
                              //       <IconButton
                              //         href={`https://hub.docker.com/search?q=${currentService.image?.split(":")[0]}&type=image`}
                              //         component={Link}
                              //         size="small"
                              //         target="_blank"
                              //       >
                              //         <OpenInNewIcon fontSize="small" />
                              //       </IconButton>
                              //     </InputAdornment>
                              //   )
                              // }}
                            />
                          )}
                        />

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <InfoCircle className="text-muted-foreground" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <>
                              The service name serves as a identifier for the workload to be ran on the Akash Network.
                              <br />
                              <br />
                              <a href="https://docs.akash.network/readme/stack-definition-language#services" target="_blank" rel="noopener">
                                View official documentation.
                              </a>
                            </>
                          </TooltipContent>
                        </Tooltip>
                        {/* <CustomTooltip
                          arrow
                          title={
                            <>
                              Docker image of the container.
                              <br />
                              <br />
                              Best practices: avoid using :latest image tags as Akash Providers heavily cache images.
                            </>
                          }
                        >
                          <InfoIcon color="disabled" fontSize="small" sx={{ marginLeft: ".5rem" }} />
                        </CustomTooltip> */}
                      </div>
                    </div>

                    <div>
                      <CpuFormControl control={control as any} currentService={currentService} serviceIndex={serviceIndex} />
                    </div>

                    <div>
                      <GpuFormControl
                        control={control as any}
                        serviceIndex={serviceIndex}
                        hasGpu={!!currentService.profile.hasGpu}
                        currentService={currentService}
                        gpuModels={gpuModels}
                        setValue={setValue}
                      />
                    </div>

                    <div>
                      <MemoryFormControl control={control as any} currentService={currentService} serviceIndex={serviceIndex} />
                    </div>

                    <div>
                      <StorageFormControl control={control as any} currentService={currentService} serviceIndex={serviceIndex} />
                    </div>

                    <div>
                      <PersistentStorage control={control as any} currentService={currentService} serviceIndex={serviceIndex} />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="grid gap-4">
                    <div>
                      <EnvVarList currentService={currentService} setIsEditingEnv={setIsEditingEnv} serviceIndex={serviceIndex} />
                    </div>

                    <div>
                      <CommandList currentService={currentService} setIsEditingCommands={setIsEditingCommands} serviceIndex={serviceIndex} />
                    </div>
                  </div>

                  <div className="mt-4">
                    <ExposeList currentService={currentService} setIsEditingExpose={setIsEditingExpose} serviceIndex={serviceIndex} />
                  </div>

                  <div className="mt-4">
                    <Controller
                      control={control}
                      name={`services.${serviceIndex}.count`}
                      rules={{
                        min: 1,
                        validate: v => {
                          if (!v) return "Service count is required.";
                          return true;
                        }
                      }}
                      render={({ field, fieldState }) => (
                        <InputWithIcon
                          type="number"
                          // variant="outlined"
                          // color="secondary"
                          label="Count"
                          value={field.value || ""}
                          // error={!!fieldState.error}
                          error={fieldState.error?.message}
                          onChange={event => {
                            const newValue = parseInt(event.target.value);
                            field.onChange(newValue);

                            if (newValue) {
                              trigger(`services.${serviceIndex}.profile.cpu`);
                              trigger(`services.${serviceIndex}.profile.ram`);
                              trigger(`services.${serviceIndex}.profile.storage`);
                            }
                          }}
                          // inputProps={{ min: 1, max: 20, step: 1 }}
                          min={1}
                          max={20}
                          step={1}
                          // size="small"
                          // fullWidth
                          endIcon={
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <InfoCircle className="text-muted-foreground" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <>
                                  The number of instances of the current service. Each instance will have the resources defined in this service.
                                  <br />
                                  <br />
                                  <a href="https://docs.akash.network/readme/stack-definition-language#deployment" target="_blank" rel="noopener">
                                    View official documentation.
                                  </a>
                                </>
                              </TooltipContent>
                            </Tooltip>
                          }
                          // InputProps={{
                          //   endAdornment: (
                          //     <InputAdornment position="end">
                          //       <CustomTooltip
                          //         arrow
                          //         title={
                          //           <>
                          //             The number of instances of the current service. Each instance will have the resources defined in this service.
                          //             <br />
                          //             <br />
                          //             <a href="https://docs.akash.network/readme/stack-definition-language#deployment" target="_blank" rel="noopener">
                          //               View official documentation.
                          //             </a>
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
              </div>
              <div className="mt-4 break-all">
                <div className="grid gap-4">
                  <div>
                    <FormPaper className="px-4 py-2">
                      <div className="mb-2 flex items-center">
                        <p>
                          <strong>Placement</strong>
                        </p>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="ml-4">
                              <InfoCircle className="text-muted-foreground" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <>
                              Placement is a list of settings to specify where to host the current service workload.
                              <br />
                              <br />
                              You can filter providers by attributes, audited by and pricing.
                              <br />
                              <br />
                              <a href="https://docs.akash.network/readme/stack-definition-language#profiles.placement" target="_blank" rel="noopener">
                                View official documentation.
                              </a>
                            </>
                          </TooltipContent>
                        </Tooltip>
                        {/* <CustomTooltip
                          arrow
                          title={
                            <>
                              Placement is a list of settings to specify where to host the current service workload.
                              <br />
                              <br />
                              You can filter providers by attributes, audited by and pricing.
                              <br />
                              <br />
                              <a href="https://docs.akash.network/readme/stack-definition-language#profiles.placement" target="_blank" rel="noopener">
                                View official documentation.
                              </a>
                            </>
                          }
                        >
                          <InfoIcon color="disabled" fontSize="small" sx={{ marginLeft: "1rem" }} />
                        </CustomTooltip> */}

                        <span className="ml-4 cursor-pointer text-xs text-primary underline" onClick={() => setIsEditingPlacement(serviceIndex)}>
                          Edit
                        </span>
                      </div>

                      <div className="text-xs">
                        <div>
                          <strong>Name</strong>&nbsp;&nbsp;
                          <span className="text-muted-foreground">{currentService.placement.name}</span>
                        </div>
                        <div>
                          <strong>Pricing</strong>&nbsp;&nbsp;
                          <span className="inline-flex items-center text-muted-foreground">
                            Max {udenomToDenom(currentService.placement.pricing.amount, 6)} AKT per block
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="ml-4">
                                  <InfoCircle className="text-muted-foreground" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <>
                                  The maximum amount of uAKT you're willing to pay per block (~6 seconds).
                                  <br />
                                  <br />
                                  Akash will only show providers costing <strong>less</strong> than this amount.
                                  <br />
                                  <br />
                                  <div>
                                    <strong>
                                      ~
                                      <PriceValue denom={uAktDenom} value={udenomToDenom(getAvgCostPerMonth(currentService.placement.pricing.amount))} />
                                    </strong>
                                    &nbsp; per month
                                  </div>
                                </>
                              </TooltipContent>
                            </Tooltip>
                            {/* <CustomTooltip
                              arrow
                              title={
                                <>
                                  The maximum amount of uAKT you're willing to pay per block (~6 seconds).
                                  <br />
                                  <br />
                                  Akash will only show providers costing <strong>less</strong> than this amount.
                                  <br />
                                  <br />
                                  <div>
                                    <strong>
                                      ~
                                      <PriceValue denom={uAktDenom} value={udenomToDenom(getAvgCostPerMonth(currentService.placement.pricing.amount))} />
                                    </strong>
                                    &nbsp; per month
                                  </div>
                                </>
                              }
                            >
                              <InfoIcon color="disabled" fontSize="inherit" sx={{ marginLeft: ".5rem" }} />
                            </CustomTooltip> */}
                          </span>
                        </div>
                        <div>
                          <strong>Attributes</strong>&nbsp;&nbsp;
                          <span className="text-muted-foreground">
                            {(currentService.placement.attributes?.length || 0) > 0
                              ? currentService.placement.attributes?.map((a, i) => (
                                  <span key={i} className="text-xs">
                                    {a.key}=<span>{a.value}</span>
                                  </span>
                                ))
                              : "None"}
                          </span>
                        </div>
                        <div>
                          <strong>Signed by any of</strong>&nbsp;&nbsp;
                          <span className="text-muted-foreground">
                            {(currentService.placement.signedBy?.anyOf?.length || 0) > 0
                              ? currentService.placement.signedBy?.anyOf?.map((a, i) => (
                                  <span key={i} className={cn({ ["ml-2"]: i !== 0 })}>
                                    {a.value}
                                  </span>
                                ))
                              : "None"}
                          </span>
                        </div>
                        <div>
                          <strong>Signed by all of</strong>&nbsp;&nbsp;
                          <span className="text-muted-foreground">
                            {(currentService.placement.signedBy?.allOf?.length || 0) > 0
                              ? currentService.placement.signedBy?.allOf?.map((a, i) => (
                                  <span key={i} className={cn({ ["ml-2"]: i !== 0 })}>
                                    {a.value}
                                  </span>
                                ))
                              : "None"}
                          </span>
                        </div>
                      </div>
                    </FormPaper>
                  </div>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </CardContent>
      </Card>
    </Collapsible>
  );
};
