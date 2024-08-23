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
  Separator
} from "@akashnetwork/ui/components";
import React, { useState } from "react";
import { ServerForm } from "./server-form";
import { Form, useForm } from "react-hook-form";
import { ChevronDownIcon, HomeIcon } from "lucide-react";
import { z } from "zod";

interface WalletImportProps {
  stepChange: (serverInformation) => void;
}

const appearanceFormSchema = z.object({
  walletMode: z.enum(["light", "dark"], {
    required_error: "Please select a theme."
  })
});

type AppearanceFormValues = z.infer<typeof appearanceFormSchema>;

export const WalletImport: React.FunctionComponent<WalletImportProps> = ({ stepChange }) => {
  const defaultValues: Partial<AppearanceFormValues> = {
    walletMode: "light"
  };

  const form = useForm<AppearanceFormValues>({
    defaultValues
  });

  function onSubmit(data: AppearanceFormValues) {
    console.log(data);
  }

  const [walletForm, setWalletForm] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-center pt-10">
      <div className="space-y-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div>
              <h3 className="text-xl font-bold">Import Wallet</h3>
              <p className="text-muted-foreground text-sm">Provider needs to import their wallet into their control machine in order to become provider.</p>
            </div>
            <div className="">
              <Separator />
            </div>
            <div className="">
              <FormField
                control={form.control}
                name="walletMode"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel>Wallet Mode</FormLabel>
                    <FormDescription>Choose which mode do you want to use to import wallet</FormDescription>
                    <FormMessage />
                    <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid max-w-md grid-cols-2 gap-8 pt-2">
                      <FormItem>
                        <FormLabel className="[&:has([data-state=checked])>div]:border-primary">
                          <FormControl>
                            <RadioGroupItem value="light" className="sr-only" />
                          </FormControl>
                          <div className="border-muted hover:border-accent items-center rounded-md border-2 p-1">
                            <div className="space-y-2 rounded-sm bg-[#ecedef] p-2">
                              <div className="space-y-2 rounded-md bg-white p-4 shadow-sm">
                                <HomeIcon />
                                <h4 className="text-md">Seed Phrase Mode</h4>
                                <p>Console will auto import using secure end-to-end encryption. Seed Phrase is Required.</p>
                                <p></p>
                              </div>
                            </div>
                          </div>
                        </FormLabel>
                      </FormItem>
                      <FormItem>
                        <FormLabel className="[&:has([data-state=checked])>div]:border-primary">
                          <FormControl>
                            <RadioGroupItem value="dark" className="sr-only" />
                          </FormControl>
                          <div className="border-muted bg-popover hover:bg-accent hover:text-accent-foreground items-center rounded-md border-2 p-1">
                            <div className="space-y-2 rounded-sm bg-slate-950 p-2">
                              <div className="space-y-2 rounded-sm bg-slate-800 p-4 text-white">
                                <HomeIcon />
                                <h4 className="text-md">Manual Mode</h4>
                                <p>You need to login to control machine and follow the instruction to import wallet. Seed Phrase is not Required.</p>
                              </div>
                            </div>
                          </div>
                        </FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormItem>
                )}
              />
            </div>
            <div className="">
              <Separator />
            </div>
            <div className="flex justify-end">
              <Button type="submit" onClick={() => setWalletForm("seed")}>
                Next
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};
