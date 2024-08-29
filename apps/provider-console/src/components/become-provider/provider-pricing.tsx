"use client";
import { Button, FormControl, FormDescription, FormField, FormItem, FormLabel, Input, Separator, Slider } from "@akashnetwork/ui/components";
import React, { useState } from "react";
import { Form, useForm } from "react-hook-form";
import { ChevronDownIcon } from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

interface ProviderPricingProps {
  resources?: {
    cpu: number;
    memory: number;
    storage: number;
    persistentStorage: number;
    gpu: number;
  };
  onSubmit: (data: ProviderPricingValues) => void;
}

const providerPricingSchema = z.object({
  cpu: z.number().min(0),
  memory: z.number().min(0),
  storage: z.number().min(0),
  gpu: z.number().min(0),
  persistentStorage: z.number().min(0),
  ipScalePrice: z.number().min(0),
  endpointBidPrice: z.number().min(0),
  bidDeposit: z.number().min(0)
});

type ProviderPricingValues = z.infer<typeof providerPricingSchema>;

export const ProviderPricing: React.FC<ProviderPricingProps> = ({ resources = {}, onSubmit }) => {
  resources = {
    cpu: 24,
    memory: 724,
    strorage: 1024,
    persistentStorage: 7024,
    gpu: 5
  };
  const [showAdvanced, setShowAdvanced] = useState(false);
  const form = useForm<ProviderPricingValues>({
    resolver: zodResolver(providerPricingSchema),
    defaultValues: {
      cpu: 1.6,
      memory: 0.8,
      storage: 0.02,
      gpu: 200,
      persistentStorage: 0.3,
      ipScalePrice: 0.3,
      endpointBidPrice: 0.3,
      bidDeposit: 0.3
    }
  });

  const calculateEstimatedEarnings = (values: ProviderPricingValues) => {
    // TODO: Implement the calculation logic
    return 25.12; // Placeholder value
  };

  const estimatedEarnings = calculateEstimatedEarnings(form.getValues());

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
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-4 gap-8">
              <div className="col-span-3 space-y-6">
                <FormField
                  control={form.control}
                  name="cpu"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-lg font-semibold">CPU</FormLabel>
                      <FormDescription>Scale Bid Price - USD/Thread-Month</FormDescription>
                      <FormControl>
                        <div className="flex items-center space-x-4">
                          <Slider value={[field.value]} onValueChange={([newValue]) => field.onChange(newValue)} max={1000} step={0.001} className="w-full" />
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
                      <FormDescription>Scale Bid Price - USD/GB-Month</FormDescription>
                      <FormControl>
                        <div className="flex items-center space-x-4">
                          <Slider value={[field.value]} onValueChange={([newValue]) => field.onChange(newValue)} max={1000} step={0.001} className="w-full" />
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
                      <FormDescription>Scale Bid Price - USD/GB-Month</FormDescription>
                      <FormControl>
                        <div className="flex items-center space-x-4">
                          <Slider value={[field.value]} onValueChange={([newValue]) => field.onChange(newValue)} max={1000} step={0.001} className="w-full" />
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
                      <FormDescription>Scale Bid Price - USD/GPU-Month</FormDescription>
                      <FormControl>
                        <div className="flex items-center space-x-4">
                          <Slider value={[field.value]} onValueChange={([newValue]) => field.onChange(newValue)} max={1000} step={0.01} className="w-full" />
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
                      <FormDescription>Scale Bid Price - USD/GB-Month</FormDescription>
                      <FormControl>
                        <div className="flex items-center space-x-4">
                          <Slider value={[field.value]} onValueChange={([newValue]) => field.onChange(newValue)} max={1000} step={0.001} className="w-full" />
                          <Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} className="w-32" step="0.001" />
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
                          <FormDescription>Scale Bid Price - USD/GB-Month</FormDescription>
                          <FormControl>
                            <div className="flex items-center space-x-4">
                              <Slider
                                value={[field.value]}
                                onValueChange={([newValue]) => field.onChange(newValue)}
                                max={1000}
                                step={0.001}
                                className="w-full"
                              />
                              <Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} className="w-32" step="0.001" />
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
                          <FormDescription>Scale Bid Price - USD/GB-Month</FormDescription>
                          <FormControl>
                            <div className="flex items-center space-x-4">
                              <Slider
                                value={[field.value]}
                                onValueChange={([newValue]) => field.onChange(newValue)}
                                max={1000}
                                step={0.001}
                                className="w-full"
                              />
                              <Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} className="w-32" step="0.001" />
                            </div>
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="bidDeposit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-lg font-semibold">Bid Deposit</FormLabel>
                          <FormDescription>Scale Bid Price - USD/GB-Month</FormDescription>
                          <FormControl>
                            <div className="flex items-center space-x-4">
                              <Slider
                                value={[field.value]}
                                onValueChange={([newValue]) => field.onChange(newValue)}
                                max={1000}
                                step={0.001}
                                className="w-full"
                              />
                              <Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} className="w-32" step="0.001" />
                            </div>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>
              <div className="space-y-6">
                <div className="bg-secondary rounded-lg p-6">
                  <h4 className="mb-4 text-lg font-semibold">Resources</h4>
                  {Object.entries(resources).length > 0 ? (
                    Object.entries(resources).map(([key, value]) => (
                      <div className="rounded-sm border text-xs mb-2">
                        <div key={key} className="flex justify-between">
                          <span className="capitalize bg-gray-200 p-2 rounded-l-sm">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                          <span className="p-2 rounded-l-sm">
                            {value} {key === "cpu" ? "" : "GB"}
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
            <div className="flex justify-end">
              <Button type="submit">Next</Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};
