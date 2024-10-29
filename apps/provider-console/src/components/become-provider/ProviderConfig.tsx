"use client";
import React from "react";
import { useForm } from "react-hook-form";
import { Button, Form, FormControl, FormField, FormItem, FormLabel, FormMessage, Input, Separator } from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAtom } from "jotai";
import { z } from "zod";

import providerProcessStore from "@src/store/providerProcessStore";
import ResetProviderForm from "./ResetProviderProcess";

interface ProviderConfigProps {
  stepChange: () => void;
}

const providerConfigSchema = z.object({
  domainName: z
    .string()
    .min(1, "Domain name is required")
    .refine(value => {
      const regex = /^(?!:\/\/)([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/;
      return regex.test(value);
    }, "Invalid domain name format"),
  organizationName: z.string().min(1, "Organization name is required"),
  emailAddress: z.string().email("Invalid email address").optional().or(z.literal(""))
});

type ProviderConfigValues = z.infer<typeof providerConfigSchema>;

export const ProviderConfig: React.FunctionComponent<ProviderConfigProps> = ({ stepChange }) => {
  const form = useForm<ProviderConfigValues>({
    resolver: zodResolver(providerConfigSchema),
    mode: "onSubmit",
    defaultValues: {
      domainName: "",
      organizationName: "",
      emailAddress: ""
    }
  });

  const [, setProviderProcess] = useAtom(providerProcessStore.providerProcessAtom);

  const submitForm = async (formValues: ProviderConfigValues) => {
    setProviderProcess(prev => ({
      ...prev,
      config: {
        domain: formValues.domainName,
        organization: formValues.organizationName,
        email: formValues.emailAddress || ""
      },
      process: {
        ...prev.process,
        providerConfig: true
      }
    }));
    stepChange();
  };

  return (
    <div className="flex w-full flex-col items-center pt-10">
      <div className="w-full max-w-2xl space-y-6">
        <div>
          <h3 className="text-xl font-bold">Provider Information</h3>
          <p className="text-muted-foreground text-sm">Please enter your provider details.</p>
        </div>
        <div>
          <Separator />
        </div>
        <div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(submitForm)} className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <FormField
                    control={form.control}
                    name="domainName"
                    render={({ field, fieldState }) => (
                      <FormItem className="flex flex-col space-y-2">
                        <FormLabel>Domain Name</FormLabel>
                        <FormControl>
                          <Input placeholder="example.com" {...field} />
                        </FormControl>
                        <FormMessage>{fieldState.error?.message}</FormMessage>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <FormField
                    control={form.control}
                    name="organizationName"
                    render={({ field, fieldState }) => (
                      <FormItem>
                        <FormLabel>Organization Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Your Organization" {...field} />
                        </FormControl>
                        <FormMessage>{fieldState.error?.message}</FormMessage>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <FormField
                    control={form.control}
                    name="emailAddress"
                    render={({ field, fieldState }) => (
                      <FormItem>
                        <FormLabel>Email Address (Optional)</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="your@email.com" {...field} />
                        </FormControl>
                        <FormMessage>{fieldState.error?.message}</FormMessage>
                      </FormItem>
                    )}
                  />
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
    </div>
  );
};
