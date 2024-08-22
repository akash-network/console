"use client";
import {
  Button,
  Checkbox,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const accountFormSchema = z.object({
  ip: z
    .string()
    .min(2, {
      message: "Name must be at least 2 characters."
    })
    .max(30, {
      message: "Name must not be longer than 30 characters."
    }),
  dob: z.date({
    required_error: "A date of birth is required."
  }),
  language: z.string({
    required_error: "Please select a language."
  }),
  port: z.string(),
  username: z.string(),
  password: z.string(),
  file: z.instanceof(File)
});

type AccountFormValues = z.infer<typeof accountFormSchema>;

// This can come from your database or API.
const defaultValues: Partial<AccountFormValues> = {
  // name: "Your name",
  // dob: new Date("2023-01-23"),
};
export const ServerForm: React.FunctionComponent = () => {
  const form = useForm<AccountFormValues>({
    // resolver: zodResolver(accountFormSchema),
    defaultValues
  });
  return (
    <div className="flex flex-col items-center pt-10">
      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-bold">Control Plane Machine Access</h3>
          <p className="text-muted-foreground text-sm"> Enter the required details for you control plane setup</p>
        </div>
        <div className="">
          <Separator />
        </div>
        <div>
          <Form {...form}>
            <form className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <FormField
                    control={form.control}
                    name="ip"
                    render={({ field }) => (
                      <FormItem className="flex flex-col space-y-2">
                        <FormLabel>Public IP</FormLabel>
                        <FormControl>
                          <Input placeholder="Input your public ip" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="">
                  <FormField
                    control={form.control}
                    name="port"
                    render={({ field }) => (
                      <FormItem className="flex flex-col space-y-2">
                        <FormLabel>Port</FormLabel>
                        <FormControl>
                          <Input placeholder="22" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              <div className="grid grid-cols-5 gap-4">
                <div className="col-span-4">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem className="flex flex-col space-y-2">
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input placeholder="Input your username" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 space-y-2">
                <p className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Choose how you would like to provider your credentials
                </p>
                <div className="rounded-md border">
                  <Tabs defaultValue="password" className="space-y-4 p-4">
                    <TabsList className="ml-auto">
                      <TabsTrigger value="password" className="text-zinc-600 dark:text-zinc-200">
                        Password
                      </TabsTrigger>
                      <TabsTrigger value="file" className="text-zinc-600 dark:text-zinc-200">
                        File
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="password">
                      <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input placeholder="Input your password" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </TabsContent>
                    <TabsContent value="file">
                      <FormField
                        control={form.control}
                        name="file"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input id="picture" type="file" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit">Next</Button>
              </div>

              <div className="rounded-md border">
                <div className="space-y-2 p-4">
                  <h4 className="text-lg font-bold">Heads up!</h4>
                  <p className="text-sm">You can apply information from Control Plain 1 to all remaining nodes by checking the option below.</p>
                  <div className="">
                    <Checkbox id="options" />
                    <label htmlFor="terms" className="pl-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Yes
                    </label>
                  </div>
                </div>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
};
