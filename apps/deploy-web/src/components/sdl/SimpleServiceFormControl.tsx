"use client";
import { Dispatch, SetStateAction, useState } from "react";
import { Control, UseFormSetValue, UseFormTrigger } from "react-hook-form";
import {
  Button,
  buttonVariants,
  Card,
  CardContent,
  CheckboxWithLabel,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  CustomTooltip,
  FormField,
  FormInput,
  FormItem,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@akashnetwork/ui/components";
import { useTheme as useMuiTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { BinMinusIn, InfoCircle, NavArrowDown, OpenInWindow } from "iconoir-react";
import Image from "next/legacy/image";
import Link from "next/link";

import { SSHKeyFormControl } from "@src/components/sdl/SSHKeyFromControl";
import { useSdlBuilder } from "@src/context/SdlBuilderProvider/SdlBuilderProvider";
import { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { GpuVendor } from "@src/types/gpu";
import { uAktDenom } from "@src/utils/constants";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { getAvgCostPerMonth } from "@src/utils/priceUtils";
import { cn } from "@src/utils/styleUtils";
import { LeaseSpecDetail } from "../shared/LeaseSpecDetail";
import { PriceValue } from "../shared/PriceValue";
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
  _services: ServiceType[];
  serviceIndex: number;
  control: Control<SdlBuilderFormValuesType, any>;
  trigger: UseFormTrigger<SdlBuilderFormValuesType>;
  onRemoveService: (index: number) => void;
  serviceCollapsed: number[];
  setServiceCollapsed: Dispatch<SetStateAction<number[]>>;
  setValue: UseFormSetValue<SdlBuilderFormValuesType>;
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
  const currentService: ServiceType = _services[serviceIndex];
  const _isEditingEnv = serviceIndex === isEditingEnv;
  const _isEditingCommands = serviceIndex === isEditingCommands;
  const _isEditingExpose = serviceIndex === isEditingExpose;
  const _isEditingPlacement = serviceIndex === isEditingPlacement;
  const { imageList, hasComponent, toggleCmp } = useSdlBuilder();

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
            <FormField
              control={control}
              name={`services.${serviceIndex}.title`}
              render={({ field, fieldState }) => (
                <FormInput
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
                  error={!!fieldState.error}
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
                      <FormField
                        control={control}
                        name={`services.${serviceIndex}.image`}
                        render={({ field, fieldState }) => (
                          <FormItem className="w-full">
                            {imageList?.length ? (
                              <div className="flex flex-grow flex-col">
                                <Select value={field.value} onValueChange={field.onChange}>
                                  <SelectTrigger className={cn("ml-1", { "ring-2 ring-destructive": !!fieldState.error })} data-testid="ssh-image-select">
                                    <Image alt="Docker Logo" src="/images/docker.png" layout="fixed" quality={100} width={24} height={18} priority />
                                    <div className="flex-1 pl-2 text-left">
                                      <SelectValue placeholder="Select image" />
                                    </div>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectGroup>
                                      {imageList.map(image => {
                                        return (
                                          <SelectItem key={image} value={image} data-testid={`ssh-image-select-${image}`}>
                                            {image}
                                          </SelectItem>
                                        );
                                      })}
                                    </SelectGroup>
                                  </SelectContent>
                                </Select>
                              </div>
                            ) : (
                              <Input
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
                                className="space-y-1"
                                value={field.value}
                                error={!!fieldState.error}
                                onChange={event => field.onChange((event.target.value || "").toLowerCase())}
                                startIconClassName="pl-2"
                                startIcon={<Image alt="Docker Logo" src="/images/docker.png" layout="fixed" quality={100} width={24} height={18} priority />}
                                endIcon={
                                  <Link
                                    href={`https://hub.docker.com/search?q=${currentService.image?.split(":")[0]}&type=image`}
                                    className={cn(
                                      buttonVariants({
                                        variant: "text",
                                        size: "icon"
                                      }),
                                      "text-muted-foreground"
                                    )}
                                    target="_blank"
                                  >
                                    <OpenInWindow />
                                  </Link>
                                }
                                data-testid="image-name-input"
                              />
                            )}

                            <FormMessage />
                          </FormItem>
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
                        setValue={setValue as any}
                      />
                    </div>

                    <div>
                      <MemoryFormControl control={control as any} serviceIndex={serviceIndex} />
                    </div>

                    <div>
                      <StorageFormControl control={control as any} serviceIndex={serviceIndex} />
                    </div>

                    <div>
                      <PersistentStorage control={control as any} currentService={currentService} serviceIndex={serviceIndex} />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="grid gap-4">
                    {(hasComponent("ssh") || hasComponent("ssh-toggle")) && (
                      <FormPaper className="whitespace-break-spaces break-all">
                        {hasComponent("ssh-toggle") && (
                          <CheckboxWithLabel
                            checked={hasComponent("ssh")}
                            onCheckedChange={checked => {
                              toggleCmp("ssh");
                              setValue("hasSSHKey", !!checked);
                            }}
                            className="ml-4"
                            label="Expose SSH"
                            data-testid="ssh-toggle"
                          />
                        )}
                        {hasComponent("ssh") && <SSHKeyFormControl control={control} serviceIndex={serviceIndex} setValue={setValue} />}
                      </FormPaper>
                    )}

                    <div>
                      <EnvVarList currentService={currentService} setIsEditingEnv={setIsEditingEnv} serviceIndex={serviceIndex} />
                    </div>

                    {hasComponent("command") && (
                      <div>
                        <CommandList currentService={currentService} setIsEditingCommands={setIsEditingCommands} serviceIndex={serviceIndex} />
                      </div>
                    )}
                  </div>

                  <div className="mt-4">
                    <ExposeList currentService={currentService} setIsEditingExpose={setIsEditingExpose} serviceIndex={serviceIndex} />
                  </div>

                  {hasComponent("service-count") && (
                    <div className="mt-4">
                      <FormField
                        control={control}
                        name={`services.${serviceIndex}.count`}
                        render={({ field, fieldState }) => (
                          <FormInput
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
                            error={!!fieldState.error}
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
                  )}

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
