"use client";
import {
  Button,
  buttonVariants,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  RadioGroup,
  RadioGroupItem,
  Separator,
  Textarea
} from "@akashnetwork/ui/components";
import React, { useState, useEffect } from "react";
import { ServerForm } from "./server-form";
import { Form, useForm } from "react-hook-form";
import { ChevronDownIcon, HomeIcon } from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

interface ProviderConfigProps {
  stepChange: (providerInformation: ProviderFormValues) => void;
}

const providerFormSchema = z.object({
  domainName: z.string().min(1, "Domain name is required"),
  organizationName: z.string().min(1, "Organization name is required"),
  emailAddress: z.string().email("Invalid email address").optional()
});

type ProviderFormValues = z.infer<typeof providerFormSchema>;

export const ProviderConfig: React.FunctionComponent<ProviderConfigProps> = ({ stepChange }) => {
  const form = useForm<ProviderFormValues>({
    resolver: zodResolver(providerFormSchema),
    defaultValues: {
      domainName: "",
      organizationName: "",
      emailAddress: ""
    }
  });

  const onSubmit = (data: ProviderFormValues) => {
    stepChange(data);
  };

  return (
    <div className="flex flex-col items-center pt-10 w-full">
      <div className="space-y-6 w-full max-w-2xl">
        <div>
          <h3 className="text-xl font-bold">Provider Information</h3>
          <p className="text-muted-foreground text-sm">Please enter your provider details.</p>
        </div>
        <div>
          <Separator />
        </div>
        <div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <FormField
                    control={form.control}
                    name="domainName"
                    render={({ field }) => (
                      <FormItem className="flex flex-col space-y-2">
                        <FormLabel>Domain Name</FormLabel>
                        <FormControl>
                          <Input placeholder="example.com" {...field} />
                        </FormControl>
                        <FormMessage />
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
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Organization Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Your Organization" {...field} />
                        </FormControl>
                        <FormMessage />
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
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address (Optional)</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="your@email.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              <div className="">
                <Separator />
              </div>
              <div className="flex justify-end">
                <Button type="submit">Submit</Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
};
