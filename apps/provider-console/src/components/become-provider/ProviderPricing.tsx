"use client";
import React, { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  Input,
  Separator,
  Slider
} from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown } from "iconoir-react";
import { useAtom } from "jotai";
import { z } from "zod";

import { useControlMachine } from "@src/context/ControlMachineProvider";
import { useGpuPrices } from "@src/queries/useProviderQuery";
import providerProcessStore from "@src/store/providerProcessStore";
import { ProviderDetails } from "@src/types/provider";
import { roundDecimal } from "@src/utils/mathHelpers";
import restClient from "@src/utils/restClient";
import { sanitizeMachineAccess } from "@src/utils/sanityUtils";
import { Title } from "../shared/Title";
import { ResetProviderForm } from "./ResetProviderProcess";

interface ProviderPricingProps {
  resources?: {
    cpu: number;
    memory: number;
    storage: number;
    persistentStorage: number;
    gpu: number;
  };
  editMode?: boolean;
  existingPricing?: ProviderPricingValues;
  disabled?: boolean;
  providerDetails?: ProviderDetails;
  onComplete?: () => void;
}

const providerPricingSchema = z.object({
  cpu: z.number().min(0),
  memory: z.number().min(0),
  storage: z.number().min(0),
  gpu: z.number().min(0),
  persistentStorage: z.number().min(0),
  ipScalePrice: z.number().min(0),
  endpointBidPrice: z.number().min(0)
});

type ProviderPricingValues = z.infer<typeof providerPricingSchema>;

const HOURS_PER_MONTH = 730.488;

interface GpuInfo {
  vendor?: string;
  name?: string;
  count: number;
  memory_size?: string;
  interface?: string;
}

export const ProviderPricing: React.FC<ProviderPricingProps> = ({ onComplete, editMode = false, existingPricing, disabled = false, providerDetails }) => {
  const [providerProcess, setProviderProcess] = useAtom(providerProcessStore.providerProcessAtom);
  const { activeControlMachine } = useControlMachine();
  const [showSuccess, setShowSuccess] = React.useState(false);
  const [resources, setResources] = useState({
    cpu: 24,
    memory: 724,
    storage: 1024,
    persistentStorage: 7024,
    gpu: 5
  });
  const [isLoading, setIsLoading] = useState(false);
  const { data: gpuPricesData } = useGpuPrices();
  const [gpuMarketPrice, setGpuMarketPrice] = useState<number | null>(null);
  const [gpuMatchDetails, setGpuMatchDetails] = useState<
    Array<{
      gpu: GpuInfo;
      matchType: string;
      price: number;
    }>
  >([]);

  useEffect(() => {
    const calculateResources = () => {
      if (!editMode) {
        let totalCpu = 0;
        let totalMemory = 0;
        let totalStorage = 0;
        let totalPersistentStorage = 0;
        let totalGpu = 0;

        providerProcess.machines.forEach(machine => {
          totalCpu += parseInt(machine.systemInfo.cpus, 10);
          totalMemory += parseInt(machine.systemInfo.memory.replace("Gi", ""), 10);
          machine.systemInfo.storage.forEach((storage, index) => {
            if (index === 0) {
              totalStorage += storage.size / (1024 * 1024 * 1024);
            } else {
              totalPersistentStorage += storage.size / (1024 * 1024 * 1024);
            }
          });
          totalGpu += machine.systemInfo.gpu.count;
        });

        setResources({
          cpu: totalCpu,
          memory: totalMemory,
          storage: totalStorage,
          persistentStorage: totalPersistentStorage,
          gpu: totalGpu
        });
      } else if (providerDetails) {
        const { activeStats, pendingStats, availableStats } = providerDetails;

        // Calculate totals by summing active, pending, and available stats
        const totalCpu = (activeStats.cpu + pendingStats.cpu + availableStats.cpu) / 1000;
        const totalGpu = activeStats.gpu + pendingStats.gpu + availableStats.gpu;
        // Convert memory from bytes to GB
        const totalMemory = Math.floor((activeStats.memory + pendingStats.memory + availableStats.memory) / (1024 * 1024 * 1024));
        // Convert storage from bytes to GB
        const totalStorage = Math.floor((activeStats.storage + pendingStats.storage + availableStats.storage) / (1024 * 1024 * 1024));

        setResources({
          cpu: totalCpu,
          memory: totalMemory,
          storage: totalStorage,
          persistentStorage: 0, // Using same storage value for persistent storage
          gpu: totalGpu
        });
      }
    };

    calculateResources();
  }, [providerProcess.machines, editMode, providerDetails]);

  useEffect(() => {
    if (!gpuPricesData) return;

    // Get GPU configurations from provider process
    const gpuConfigs = providerProcess.machines?.map(machine => machine.systemInfo?.gpu).filter(Boolean);

    if (!gpuConfigs?.length) return;

    // Calculate weighted average price based on matching GPUs
    let totalWeightedPrice = 0;
    let totalGpus = 0;
    const matchDetails: Array<{
      gpu: GpuInfo;
      matchType: string;
      price: number;
    }> = [];

    gpuConfigs.forEach(gpu => {
      if (!gpu || !gpu.count) return; // Skip if gpu is undefined or count is 0

      // Try exact match first (vendor + model + ram + interface)
      let matchingModel = gpuPricesData.models.find(
        model =>
          model.vendor?.toLowerCase() === gpu.vendor?.toLowerCase() &&
          model.model?.toLowerCase() === gpu.name?.toLowerCase() &&
          model.ram?.toLowerCase() === gpu.memory_size?.toLowerCase() &&
          model.interface?.toLowerCase() === gpu.interface?.toLowerCase()
      );

      let matchType = "exact";

      // If no exact match, try vendor + model + ram
      if (!matchingModel) {
        matchingModel = gpuPricesData.models.find(
          model =>
            model.vendor?.toLowerCase() === gpu.vendor?.toLowerCase() &&
            model.model?.toLowerCase() === gpu.name?.toLowerCase() &&
            model.ram?.toLowerCase() === gpu.memory_size?.toLowerCase()
        );
        matchType = "vendor+model+ram";
      }

      // If still no match, try vendor + model
      if (!matchingModel) {
        matchingModel = gpuPricesData.models.find(
          model => model.vendor?.toLowerCase() === gpu.vendor?.toLowerCase() && model.model?.toLowerCase() === gpu.name?.toLowerCase()
        );
        matchType = "vendor+model";
      }

      // Default GPU price per hour
      const defaultGpuPrice = 0.55;

      if (matchingModel) {
        totalWeightedPrice += matchingModel.price.weightedAverage * gpu.count;
        totalGpus += gpu.count;

        matchDetails.push({
          gpu,
          matchType,
          price: matchingModel.price.weightedAverage
        });
      } else {
        // Use default price for unmatched GPUs
        totalWeightedPrice += defaultGpuPrice * gpu.count;
        totalGpus += gpu.count;

        matchDetails.push({
          gpu,
          matchType: "default",
          price: defaultGpuPrice
        });
      }
    });

    const averageMarketPrice = totalGpus > 0 ? totalWeightedPrice / totalGpus : 0.55; // Default to 0.55 if no GPUs
    setGpuMarketPrice(averageMarketPrice);

    // Store match details for display
    setGpuMatchDetails(matchDetails);
  }, [gpuPricesData, providerProcess.machines]);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const form = useForm<ProviderPricingValues>({
    resolver: zodResolver(providerPricingSchema),
    defaultValues:
      editMode && existingPricing
        ? {
            gpu: Number((existingPricing.gpu / HOURS_PER_MONTH).toFixed(3)),
            cpu: Number((existingPricing.cpu / HOURS_PER_MONTH).toFixed(4)),
            memory: Number((existingPricing.memory / HOURS_PER_MONTH).toFixed(4)),
            storage: Number((existingPricing.storage / HOURS_PER_MONTH).toFixed(6)),
            persistentStorage: Number((existingPricing.persistentStorage / HOURS_PER_MONTH).toFixed(5)),
            ipScalePrice: Number((existingPricing.ipScalePrice / HOURS_PER_MONTH).toFixed(4)),
            endpointBidPrice: Number((existingPricing.endpointBidPrice / HOURS_PER_MONTH).toFixed(5))
          }
        : {
            gpu: 0.55,
            cpu: 0.0022,
            memory: 0.0011,
            storage: 0.000027,
            persistentStorage: 0.0004,
            ipScalePrice: 0.0069,
            endpointBidPrice: 0.00069
          }
  });

  useEffect(() => {
    if (editMode && existingPricing) {
      const hourlyPricing = {
        gpu: Number((existingPricing.gpu / HOURS_PER_MONTH).toFixed(3)),
        cpu: Number((existingPricing.cpu / HOURS_PER_MONTH).toFixed(4)),
        memory: Number((existingPricing.memory / HOURS_PER_MONTH).toFixed(4)),
        storage: Number((existingPricing.storage / HOURS_PER_MONTH).toFixed(6)),
        persistentStorage: Number((existingPricing.persistentStorage / HOURS_PER_MONTH).toFixed(5)),
        ipScalePrice: Number((existingPricing.ipScalePrice / HOURS_PER_MONTH).toFixed(4)),
        endpointBidPrice: Number((existingPricing.endpointBidPrice / HOURS_PER_MONTH).toFixed(5))
      };
      form.reset(hourlyPricing);
    }
  }, [editMode, existingPricing, form]);

  useEffect(() => {
    if (!editMode && gpuMarketPrice !== null) {
      form.setValue("gpu", Number(gpuMarketPrice.toFixed(3)));
    }
  }, [gpuMarketPrice, editMode, form]);

  const watchValues = form.watch();

  const calculateEstimatedEarnings = useCallback(
    (values: ProviderPricingValues) => {
      const { cpu, memory, storage, gpu, persistentStorage, ipScalePrice, endpointBidPrice } = values;

      const totalCpuEarnings = resources.cpu * cpu;
      const totalMemoryEarnings = resources.memory * memory;
      const totalStorageEarnings = resources.storage * storage;
      const totalGpuEarnings = resources.gpu * gpu;
      const totalPersistentStorageEarnings = resources.persistentStorage * persistentStorage;
      const totalIpScaleEarnings = ipScalePrice;
      const totalEndpointBidEarnings = endpointBidPrice;

      const totalEarnings =
        totalCpuEarnings +
        totalMemoryEarnings +
        totalStorageEarnings +
        totalGpuEarnings +
        totalPersistentStorageEarnings +
        totalIpScaleEarnings +
        totalEndpointBidEarnings;

      return totalEarnings * 0.8 * 730.88;
    },
    [resources]
  );

  const estimatedEarnings = calculateEstimatedEarnings(watchValues);

  const calculateDefaultEarnings = useCallback(() => {
    const defaultPricing = {
      gpu: gpuMarketPrice ?? 0.55,
      cpu: 0.0022,
      memory: 0.0011,
      storage: 0.000027,
      persistentStorage: 0.0004,
      ipScalePrice: 0.0069,
      endpointBidPrice: 0.00069
    };

    const { cpu, memory, storage, gpu, persistentStorage, ipScalePrice, endpointBidPrice } = defaultPricing;

    const totalCpuEarnings = resources.cpu * cpu;
    const totalMemoryEarnings = resources.memory * memory;
    const totalStorageEarnings = resources.storage * storage;
    const totalGpuEarnings = resources.gpu * gpu;
    const totalPersistentStorageEarnings = resources.persistentStorage * persistentStorage;
    const totalIpScaleEarnings = ipScalePrice;
    const totalEndpointBidEarnings = endpointBidPrice;

    const totalEarnings =
      totalCpuEarnings +
      totalMemoryEarnings +
      totalStorageEarnings +
      totalGpuEarnings +
      totalPersistentStorageEarnings +
      totalIpScaleEarnings +
      totalEndpointBidEarnings;

    return totalEarnings * 0.8 * 730.88;
  }, [resources, gpuMarketPrice]);

  const competitiveEarnings = calculateDefaultEarnings();

  const updateProviderPricingAndProceed = async (data: ProviderPricingValues) => {
    setIsLoading(true);
    // Convert hourly prices to monthly prices
    const monthlyPricing = {
      gpu: data.gpu * HOURS_PER_MONTH,
      cpu: data.cpu * HOURS_PER_MONTH,
      memory: data.memory * HOURS_PER_MONTH,
      storage: data.storage * HOURS_PER_MONTH,
      persistentStorage: data.persistentStorage * HOURS_PER_MONTH,
      ipScalePrice: data.ipScalePrice * HOURS_PER_MONTH,
      endpointBidPrice: data.endpointBidPrice * HOURS_PER_MONTH
    };

    if (!editMode) {
      setProviderProcess(prev => ({
        ...prev,
        pricing: monthlyPricing,
        process: {
          ...prev.process,
          providerPricing: true
        }
      }));
      onComplete && onComplete();
    } else {
      const request = {
        control_machine: sanitizeMachineAccess(activeControlMachine),
        pricing: monthlyPricing
      };

      const response = await restClient.post(`/update-provider-pricing`, request);
      if (response) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 20000);
      }
    }
    setIsLoading(false);
  };

  return (
    <div className={`flex w-full flex-col items-center ${!editMode ? "pt-10" : "pt-5"}`}>
      <div className={`w-full ${!editMode ? "max-w-5xl" : ""} space-y-6`}>
        <div>
          {editMode ? <Title>Edit Provider Pricing</Title> : <h3 className="text-xl font-bold">Provider Pricing</h3>}
          <p className="text-muted-foreground text-sm">
            The prices you set here determine the price your provider bids with and total revenue it earns for you.
          </p>
        </div>
        <div className="">
          <Separator />
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(updateProviderPricingAndProceed)} className="space-y-6">
            <div className="grid grid-cols-5 gap-8">
              <div className="col-span-3 space-y-6">
                <FormField
                  control={form.control}
                  name="gpu"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-lg font-semibold">GPU</FormLabel>
                      <p className="text-muted-foreground text-sm">Same price will be applied to all GPU models in case of a heterogeneous provider </p>
                      <FormControl>
                        <div className="flex items-center space-x-4">
                          <Slider
                            disabled={disabled}
                            value={[field.value]}
                            onValueChange={([newValue]) => field.onChange(newValue)}
                            max={3}
                            step={0.001}
                            className="w-full"
                          />
                          <Input
                            disabled={disabled}
                            type="number"
                            {...field}
                            onChange={e => field.onChange(Number(parseFloat(e.target.value).toFixed(3)))}
                            className="w-72"
                            step="0.001"
                            endIcon={<span className="text-muted-foreground pr-3 text-sm">USD/GPU-hour</span>}
                          />
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cpu"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-lg font-semibold">CPU</FormLabel>
                      <FormControl>
                        <div className="flex items-center space-x-4">
                          <Slider
                            disabled={disabled}
                            value={[field.value]}
                            onValueChange={([newValue]) => field.onChange(newValue)}
                            max={0.01}
                            step={0.0001}
                            className="w-full"
                          />
                          <Input
                            disabled={disabled}
                            type="number"
                            {...field}
                            onChange={e => field.onChange(Number(parseFloat(e.target.value).toFixed(4)))}
                            className="w-72"
                            step="0.001"
                            endIcon={<span className="text-muted-foreground pr-3 text-sm">USD/thread-hour</span>}
                          />
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="memory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-lg font-semibold">Memory</FormLabel>
                      <FormControl>
                        <div className="flex items-center space-x-4">
                          <Slider
                            disabled={disabled}
                            value={[field.value]}
                            onValueChange={([newValue]) => field.onChange(newValue)}
                            max={0.005}
                            step={0.0001}
                            className="w-full"
                          />
                          <Input
                            disabled={disabled}
                            type="number"
                            {...field}
                            onChange={e => field.onChange(Number(parseFloat(e.target.value).toFixed(4)))}
                            className="w-72"
                            step="0.001"
                            endIcon={<span className="text-muted-foreground pr-3 text-sm">USD/GB-hour</span>}
                          />
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="storage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-lg font-semibold">Ephemeral Storage</FormLabel>
                      <FormControl>
                        <div className="flex items-center space-x-4">
                          <Slider
                            disabled={disabled}
                            value={[field.value]}
                            onValueChange={([newValue]) => field.onChange(newValue)}
                            max={0.0001}
                            step={0.000001}
                            className="w-full"
                          />
                          <Input
                            disabled={disabled}
                            type="number"
                            {...field}
                            onChange={e => field.onChange(Number(parseFloat(e.target.value).toFixed(6)))}
                            className="w-72"
                            step="0.001"
                            endIcon={<span className="text-muted-foreground pr-3 text-sm">USD/GB-hour</span>}
                          />
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="persistentStorage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-lg font-semibold">Persistent Storage</FormLabel>
                      <FormControl>
                        <div className="flex items-center space-x-4">
                          <Slider
                            disabled={disabled}
                            value={[field.value]}
                            onValueChange={([newValue]) => field.onChange(newValue)}
                            max={0.002}
                            step={0.00001}
                            className="w-full"
                          />
                          <Input
                            disabled={disabled}
                            type="number"
                            {...field}
                            onChange={e => field.onChange(Number(parseFloat(e.target.value).toFixed(5)))}
                            className="w-72"
                            step="0.01"
                            endIcon={<span className="text-muted-foreground pr-3 text-sm">USD/GB-hour</span>}
                          />
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div>
                  <Button type="button" variant="outline" disabled={disabled} onClick={() => setShowAdvanced(!showAdvanced)} className="justify-between">
                    Advanced Settings
                    <ArrowDown className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
                  </Button>
                </div>

                {showAdvanced && (
                  <div className="space-y-6">
                    <FormField
                      control={form.control}
                      name="ipScalePrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-lg font-semibold">IP Scale Price</FormLabel>
                          <FormControl>
                            <div className="flex items-center space-x-4">
                              <Slider
                                disabled={disabled}
                                value={[field.value]}
                                onValueChange={([newValue]) => field.onChange(newValue)}
                                max={0.02}
                                step={0.0001}
                                className="w-full"
                              />
                              <Input
                                disabled={disabled}
                                type="number"
                                {...field}
                                onChange={e => field.onChange(Number(parseFloat(e.target.value).toFixed(4)))}
                                className="w-72"
                                step="0.1"
                                endIcon={<span className="text-muted-foreground pr-3 text-sm">USD/IP-hour</span>}
                              />
                            </div>
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="endpointBidPrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-lg font-semibold">Endpoint Bid Price</FormLabel>
                          <FormControl>
                            <div className="flex items-center space-x-4">
                              <Slider
                                disabled={disabled}
                                value={[field.value]}
                                onValueChange={([newValue]) => field.onChange(newValue)}
                                max={0.003}
                                step={0.00001}
                                className="w-full"
                              />
                              <Input
                                disabled={disabled}
                                type="number"
                                {...field}
                                onChange={e => field.onChange(Number(parseFloat(e.target.value).toFixed(5)))}
                                className="w-72"
                                step="0.01"
                                endIcon={<span className="text-muted-foreground pr-3 text-sm">USD/port-hour</span>}
                              />
                            </div>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>
              <div className="col-span-2 space-y-6">
                <div className="bg-secondary rounded-lg p-6">
                  <h4 className="mb-4 text-lg font-semibold">Resources</h4>
                  {Object.entries(resources).length > 0 ? (
                    Object.entries(resources)
                      .sort(([keyA], [keyB]) => (keyA === "gpu" ? -1 : keyB === "gpu" ? 1 : 0))
                      .map(([key, value]) => (
                        <div key={key} className="resource-item mb-2 rounded-sm border text-xs">
                          <div className="flex justify-between">
                            <span className="rounded-l-sm p-2 capitalize">
                              {key === "storage"
                                ? "Ephemeral Storage"
                                : key === "cpu" || key === "gpu"
                                  ? key.toUpperCase()
                                  : key.replace(/([A-Z])/g, " $1").trim()}
                            </span>
                            <span className="rounded-l-sm p-2 font-bold">
                              {key === "cpu" || key === "gpu" ? value : Math.round(Number(value))} {key === "cpu" || key === "gpu" ? "" : "GB"}
                            </span>
                          </div>
                        </div>
                      ))
                  ) : (
                    <p className="text-muted-foreground text-sm">No resources information available.</p>
                  )}
                </div>
                <div className="bg-secondary rounded-lg p-6">
                  <h4 className="mb-2 text-lg font-semibold">Estimated Monthly Earnings</h4>
                  <p className="text-muted-foreground mb-4 text-sm">The earnings are estimated and based on 80% resource utilization</p>
                  <div className="text-2xl font-bold">{isNaN(estimatedEarnings) ? "-" : `$${roundDecimal(estimatedEarnings)}/month`}</div>
                </div>
                <div className="bg-secondary rounded-lg p-6">
                  <h4 className="mb-2 text-lg font-semibold">Comparative Pricing Insights</h4>
                  <p className="text-muted-foreground mb-4 text-sm">
                    See how other providers price similar resources on the Akash Network. Use this information to set competitive rates and maximize your
                    monthly earnings.
                  </p>
                  <div>
                    <span className="text-sm">Benchmark Price</span>
                    <div className="text-2xl font-bold">${competitiveEarnings.toFixed(2)}/month</div>
                    {gpuMarketPrice && resources.gpu > 0 && (
                      <p className="text-muted-foreground mt-2 text-sm">Current market rate for your GPU configuration: ${gpuMarketPrice.toFixed(2)}/hour</p>
                    )}

                    {/* GPU Match Details */}
                    {gpuMatchDetails.length > 0 && gpuMatchDetails.some(detail => detail.gpu.count > 0) && (
                      <div className="mt-4 text-xs">
                        <p className="mb-1 font-semibold">GPU Pricing Details:</p>
                        <ul className="space-y-1">
                          {gpuMatchDetails
                            .filter(detail => detail.gpu.count > 0)
                            .map((detail, index) => (
                              <li key={index} className="text-muted-foreground">
                                {detail.gpu.vendor} {detail.gpu.name} ({detail.gpu.count}x):
                                {detail.matchType === "exact" ? (
                                  <span className="text-green-500">Same GPU Model</span>
                                ) : detail.matchType === "vendor+model+ram" ? (
                                  <span className="text-yellow-500"> Matched vendor, model, and RAM</span>
                                ) : detail.matchType === "vendor+model" ? (
                                  <span className="text-yellow-500"> Matched vendor and model</span>
                                ) : (
                                  <span className="text-red-500"> No match, using default price</span>
                                )}{" "}
                                - ${detail.price.toFixed(2)}/hour
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="">
              <Separator />
            </div>
            <div className="flex w-full justify-between">
              <div className="flex justify-start">{!editMode && <ResetProviderForm />}</div>
              <div className="flex justify-end">
                <Button type="submit" disabled={disabled || isLoading}>
                  {isLoading ? "Loading..." : "Next"}
                </Button>
              </div>
            </div>
          </form>
        </Form>
        {showSuccess && !isLoading && (
          <Alert variant="success">
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>Provider pricing updated successfully</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
};

<style jsx>{`
  .resource-item {
    width: 100%;
  }
`}</style>;
