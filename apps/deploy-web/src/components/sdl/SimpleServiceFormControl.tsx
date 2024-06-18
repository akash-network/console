"use client";
import { Dispatch, SetStateAction, useState } from "react";
import { Control, Controller, UseFormSetValue, UseFormTrigger } from "react-hook-form";
import { useTheme as useMuiTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { BinMinusIn, InfoCircle, NavArrowDown, OpenInWindow } from "iconoir-react";
import Image from "next/legacy/image";
import Link from "next/link";

import { SdlBuilderFormValues, Service } from "@src/types";
import { GpuVendor } from "@src/types/gpu";
import { uAktDenom } from "@src/utils/constants";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { getAvgCostPerMonth } from "@src/utils/priceUtils";
import { cn } from "@src/utils/styleUtils";
import { LeaseSpecDetail } from "../shared/LeaseSpecDetail";
import { PriceValue } from "../shared/PriceValue";
import {
  Button,
  buttonVariants,
  Card,
  CardContent,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  InputWithIcon,
  CustomTooltip
} from "@akashnetwork/ui/components";
import { CommandFormModal } from "./CommandFormModal";
import { CommandList } from "./CommandList";
import { CpuFormControl } from "./CpuFormControl";
import { EnvFormModal } from "./EnvFormModal";
import { EnvVarList } from "./EnvVarList";
import { ExposeFormModal } from "./ExposeFormModal";
import { ExposeList } from "./ExposeList";
import { FormPaper } from "./FormPaper";
import { GpuFormControl } from "./GpuFormControl";
import { MemoryFormControl } from "./MemoryFormControl";
import { PersistentStorage } from "./PersistentStorage";
import { PlacementFormModal } from "./PlacementFormModal";
import { StorageFormControl } from "./StorageFormControl";
import { TokenFormControl } from "./TokenFormControl";

type Props = {
  _services: Service[];
  serviceIndex: number;
  control: Control<SdlBuilderFormValues, any>;
  trigger: UseFormTrigger<SdlBuilderFormValues>;
  onRemoveService: (index: number) => void;
  serviceCollapsed: number[];
  setServiceCollapsed: Dispatch<SetStateAction<number[]>>;
  setValue: UseFormSetValue<SdlBuilderFormValues>;
  gpuModels: GpuVendor[] | undefined;
  hasSecretOption?: boolean;
};

export const SimpleServiceFormControl: React.FunctionComponent<Props> = ({
  serviceIndex,
  control,
  _services,
  onRemoveService,
  trigger,
  serviceCollapsed,
  setServiceCollapsed,
  setValue,
  gpuModels,
  hasSecretOption
}) => {
  const [isEditingCommands, setIsEditingCommands] = useState<number | boolean | null>(null);
  const [isEditingEnv, setIsEditingEnv] = useState<number | boolean | null>(null);
  const [isEditingExpose, setIsEditingExpose] = useState<number | boolean | null>(null);
  const [isEditingPlacement, setIsEditingPlacement] = useState<number | boolean | null>(null);
  const muiTheme = useMuiTheme();
  const isDesktop = useMediaQuery(muiTheme.breakpoints.up("sm"));
  const expanded = !serviceCollapsed.some(x => x === serviceIndex);
  const currentService: Service = _services[serviceIndex];
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

  if (!currentService) return null;

  return (
    <Collapsible open={expanded} onOpenChange={onExpandClick}>
      <Card className="mt-4 rounded-sm border border-muted-foreground/20">
        <CardContent className="p-0">
          {/** Edit Environment Variables */}
          {_isEditingEnv && (
            <EnvFormModal
              control={control}
              onClose={() => setIsEditingEnv(null)}
              serviceIndex={serviceIndex}
              envs={currentService.env || []}
              hasSecretOption={hasSecretOption}
            />
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

          <div className={cn("flex items-end justify-between p-4", { ["border-b border-muted-foreground/20"]: expanded })}>
            <Controller
              control={control}
              name={`services.${serviceIndex}.title`}
              rules={{
                required: "Service name is required.",
                validate: value => {
                  const hasValidChars = /^[a-z0-9-]+$/.test(value);
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
                  label={
                    <div className="inline-flex items-center">
                      Service Name
                      <CustomTooltip
                        title={
                          <>
                            The service name serves as a identifier for the workload to be ran on the Akash Network.
                            <br />
                            <br />
                            <a href="https://akash.network/docs/getting-started/stack-definition-language/#services" target="_blank" rel="noopener">
                              View official documentation.
                            </a>
                          </>
                        }
                      >
                        <InfoCircle className="ml-2 text-xs text-muted-foreground" />
                      </CustomTooltip>
                    </div>
                  }
                  color="secondary"
                  // errorMessage={!!fieldState.error}
                  // helperText={fieldState.error?.message}
                  error={fieldState.error?.message}
                  value={field.value}
                  className="flex-grow"
                  onChange={event => field.onChange((event.target.value || "").toLowerCase())}
                />
              )}
            />

            <div className="ml-4 flex items-center">
              {!expanded && isDesktop && (
                <div className="flex items-center whitespace-nowrap">
                  <LeaseSpecDetail type="cpu" className="flex-shrink-0" value={currentService.profile.cpu} />
                  <LeaseSpecDetail type="ram" className="ml-4 flex-shrink-0" value={`${currentService.profile.ram} ${currentService.profile.ramUnit}`} />
                  <LeaseSpecDetail
                    type="storage"
                    className="ml-4 flex-shrink-0"
                    value={`${currentService.profile.storage} ${currentService.profile.storageUnit}`}
                  />
                </div>
              )}
              {_services.length > 1 && (
                <Button size="icon" className="ml-2" variant="ghost" onClick={() => onRemoveService(serviceIndex)}>
                  <BinMinusIn />
                </Button>
              )}

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
                    <div className="flex items-end">
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
                            label={
                              <div className="inline-flex items-center">
                                Docker Image / OS
                                <CustomTooltip
                                  title={
                                    <>
                                      Docker image of the container.
                                      <br />
                                      <br />
                                      Best practices: avoid using :latest image tags as Akash Providers heavily cache images.
                                    </>
                                  }
                                >
                                  <InfoCircle className="ml-2 text-xs text-muted-foreground" />
                                </CustomTooltip>
                              </div>
                            }
                            placeholder="Example: mydockerimage:1.01"
                            color="secondary"
                            // error={!!fieldState.error}
                            error={fieldState.error?.message}
                            className="flex-grow"
                            value={field.value}
                            onChange={event => field.onChange((event.target.value || "").toLowerCase())}
                            startIcon={<Image alt="Docker Logo" src="/images/docker.png" layout="fixed" quality={100} width={24} height={18} priority />}
                            endIcon={
                              <Link
                                href={`https://hub.docker.com/search?q=${currentService.image?.split(":")[0]}&type=image`}
                                className={cn(buttonVariants({ variant: "text", size: "icon" }), "text-muted-foreground")}
                                target="_blank"
                              >
                                <OpenInWindow />
                              </Link>
                            }
                          />
                        )}
                      />
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
                          label={
                            <div className="inline-flex items-center">
                              Service Count
                              <CustomTooltip
                                title={
                                  <>
                                    The number of instances of the service to run.
                                    <br />
                                    <br />
                                    <a
                                      href="https://akash.network/docs/getting-started/stack-definition-language/#profilesplacement"
                                      target="_blank"
                                      rel="noopener"
                                    >
                                      View official documentation.
                                    </a>
                                  </>
                                }
                              >
                                <InfoCircle className="ml-2 text-xs text-muted-foreground" />
                              </CustomTooltip>
                            </div>
                          }
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
                          min={1}
                          max={20}
                          step={1}
                        />
                      )}
                    />
                  </div>

                  <div className="mt-4">
                    <TokenFormControl control={control} name={`services.${serviceIndex}.placement.pricing.denom`} />
                  </div>
                </div>
              </div>
              <div className="mt-4 break-all">
                <div className="grid gap-4">
                  <div>
                    <FormPaper>
                      <div className="mb-2 flex items-center">
                        <strong className="text-sm">Placement</strong>

                        <CustomTooltip
                          title={
                            <>
                              Placement is a list of settings to specify where to host the current service workload.
                              <br />
                              <br />
                              You can filter providers by attributes, audited by and pricing.
                              <br />
                              <br />
                              <a href="https://akash.network/docs/getting-started/stack-definition-language/#profilesplacement" target="_blank" rel="noopener">
                                View official documentation.
                              </a>
                            </>
                          }
                        >
                          <InfoCircle className="ml-2 text-xs text-muted-foreground" />
                        </CustomTooltip>

                        <span className="ml-4 cursor-pointer text-sm text-primary underline" onClick={() => setIsEditingPlacement(serviceIndex)}>
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
                            <CustomTooltip
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
                              <InfoCircle className="ml-2 text-xs text-muted-foreground" />
                            </CustomTooltip>
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
