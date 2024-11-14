"use client";
import { Button, FormControl, FormDescription, FormField, FormItem, FormLabel, Input, Separator, Slider, Form } from "@akashnetwork/ui/components";
import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { ChevronDownIcon } from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAtom } from "jotai";
import providerProcessStore from "@src/store/providerProcessStore";
import ResetProviderForm from "./ResetProviderProcess";

interface ProviderPricingProps {
  resources?: {
    cpu: number;
    memory: number;
    storage: string;
    persistentStorage: number;
    gpu: number;
  };
  stepChange: () => void;
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

export const ProviderPricing: React.FC<ProviderPricingProps> = ({ stepChange }) => {
  const [providerProcess, setProviderProcess] = useAtom(providerProcessStore.providerProcessAtom);
  const [resources, setResources] = useState({
    cpu: 24,
    memory: 724,
    storage: 1024,
    persistentStorage: 7024,
    gpu: 5
  });

  useEffect(() => {
    const calculateResources = () => {
      let totalCpu = 0;
      let totalMemory = 0;
      let totalStorage = 0;
      let totalPersistentStorage = 0;
      let totalGpu = 0;

      providerProcess.machines.forEach(machine => {
        totalCpu += parseInt(machine.systemInfo.cpus, 10);
        totalMemory += parseInt(machine.systemInfo.memory.replace("Gi", ""), 10); // Memory in GiB
        machine.systemInfo.storage.forEach((storage, index) => {
          if (index === 0) {
            totalStorage += storage.size / (1024 * 1024 * 1024); // Convert bytes to GB
          } else {
            totalPersistentStorage += storage.size / (1024 * 1024 * 1024); // Convert bytes to GB
          }
        });
        totalGpu += machine.systemInfo.gpu.count;
      });

      setResources({
        cpu: totalCpu,
        memory: totalMemory, // Memory in GiB
        storage: totalStorage,
        persistentStorage: totalPersistentStorage,
        gpu: totalGpu
      });
    };

    calculateResources();
  }, [providerProcess.machines]);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const form = useForm<ProviderPricingValues>({
    resolver: zodResolver(providerPricingSchema),
    defaultValues: {
      cpu: 1.6,
      memory: 0.8,
      storage: 0.02,
      gpu: 100,
      persistentStorage: 0.3,
      ipScalePrice: 5,
      endpointBidPrice: 0.5
    }
  });

  const watchValues = form.watch(); // Watch all form values

  const calculateEstimatedEarnings = (values: ProviderPricingValues) => {
    const { cpu, memory, storage, gpu, persistentStorage, ipScalePrice, endpointBidPrice } = values;

    const totalCpuEarnings = resources.cpu * cpu;
    const totalMemoryEarnings = resources.memory * memory;
    const totalStorageEarnings = resources.storage * storage;
    const totalGpuEarnings = resources.gpu * gpu;
    const totalPersistentStorageEarnings = resources.persistentStorage * persistentStorage;
    const totalIpScaleEarnings = ipScalePrice; // Assuming a single IP
    const totalEndpointBidEarnings = endpointBidPrice; // Assuming a single endpoint

    const totalEarnings =
      totalCpuEarnings +
      totalMemoryEarnings +
      totalStorageEarnings +
      totalGpuEarnings +
      totalPersistentStorageEarnings +
      totalIpScaleEarnings +
      totalEndpointBidEarnings;

    return totalEarnings * 0.8;
  };

  const estimatedEarnings = calculateEstimatedEarnings(watchValues);

  const submit = (data: any) => {
    console.log(data);
    setProviderProcess(prev => ({
      ...prev,
      pricing: data,
      process: {
        ...prev.process,
        providerPricing: true
      }
    }));
    stepChange();
  };

  return (
    <div className="flex w-full flex-col items-center pt-10">
      <div className="w-full max-w-5xl space-y-6">
        <div>
          <h3 className="text-2xl font-bold">Provider Pricing</h3>
          <p className="text-muted-foreground text-sm">Set Provider Pricing to earn rewards</p>
        </div>
        <div className="">
          <Separator />
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-6">
            <div className="grid grid-cols-5 gap-8">
              <div className="col-span-3 space-y-6">
                <FormField
                  control={form.control}
                  name="cpu"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-lg font-semibold">CPU</FormLabel>
                      <FormDescription>Scale Bid Price - USD/thread-month</FormDescription>
                      <FormControl>
                        <div className="flex items-center space-x-4">
                          <Slider value={[field.value]} onValueChange={([newValue]) => field.onChange(newValue)} max={4} step={0.01} className="w-full" />
                          <Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} className="w-32" step="0.001" />
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
                      <FormDescription>Scale Bid Price - USD/GB-month</FormDescription>
                      <FormControl>
                        <div className="flex items-center space-x-4">
                          <Slider value={[field.value]} onValueChange={([newValue]) => field.onChange(newValue)} max={4} step={0.001} className="w-full" />
                          <Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} className="w-32" step="0.001" />
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
                      <FormLabel className="text-lg font-semibold">Storage</FormLabel>
                      <FormDescription>Scale Bid Price - USD/GB-month</FormDescription>
                      <FormControl>
                        <div className="flex items-center space-x-4">
                          <Slider value={[field.value]} onValueChange={([newValue]) => field.onChange(newValue)} max={0.1} step={0.001} className="w-full" />
                          <Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} className="w-32" step="0.001" />
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="gpu"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-lg font-semibold">GPU</FormLabel>
                      <FormDescription>Scale Bid Price - USD/GPU-month</FormDescription>
                      <FormControl>
                        <div className="flex items-center space-x-4">
                          <Slider value={[field.value]} onValueChange={([newValue]) => field.onChange(newValue)} max={500} step={0.01} className="w-full" />
                          <Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} className="w-32" step="0.01" />
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
                      <FormDescription>Scale Bid Price - USD/GB-month</FormDescription>
                      <FormControl>
                        <div className="flex items-center space-x-4">
                          <Slider value={[field.value]} onValueChange={([newValue]) => field.onChange(newValue)} max={1} step={0.01} className="w-full" />
                          <Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} className="w-32" step="0.01" />
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div>
                  <Button type="button" variant="outline" onClick={() => setShowAdvanced(!showAdvanced)} className="justify-between">
                    Advanced Settings
                    <ChevronDownIcon className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
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
                          <FormDescription>Scale Bid Price - USD/leased IP-month</FormDescription>
                          <FormControl>
                            <div className="flex items-center space-x-4">
                              <Slider value={[field.value]} onValueChange={([newValue]) => field.onChange(newValue)} max={10} step={0.1} className="w-full" />
                              <Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} className="w-32" step="0.1" />
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
                          <FormDescription>Scale Bid Price - USD/port-month</FormDescription>
                          <FormControl>
                            <div className="flex items-center space-x-4">
                              <Slider value={[field.value]} onValueChange={([newValue]) => field.onChange(newValue)} max={1} step={0.01} className="w-full" />
                              <Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} className="w-32" step="0.01" />
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
                    Object.entries(resources).map(([key, value]) => (
                      <div key={key} className="resource-item mb-2 rounded-sm border text-xs">
                        <div className="flex justify-between">
                          <span className="rounded-l-sm p-2 capitalize" style={{ width: 150 }}>
                            {key.replace(/([A-Z])/g, " $1").trim()}
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
                  <div className="text-2xl font-bold">${estimatedEarnings.toFixed(2)}/month</div>
                </div>
                <div className="bg-secondary rounded-lg p-6">
                  <h4 className="mb-2 text-lg font-semibold">Competitive Pricing Insights</h4>
                  <p className="text-muted-foreground mb-4 text-sm">
                    See how other providers price similar resources on the Akash Network. Use this information to set competitive rates and maximize your
                    monthly earnings.
                  </p>
                  <div>
                    <span className="text-sm">Benchmark Price</span>
                    <div className="text-2xl font-bold">$19.05/month</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="">
              <Separator />
            </div>
            <div className="flex w-full justify-between">
              <div className="flex justify-start">
                <ResetProviderForm />
              </div>
              <div className="flex justify-end">
                <Button type="submit">Next</Button>
              </div>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};

<style jsx>{`
  .resource-item {
    width: 100%;
  }
`}</style>;
