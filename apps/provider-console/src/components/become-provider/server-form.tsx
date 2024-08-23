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
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const accountFormSchema = z.object({
  ip: z
    .string()
    .min(2, {
      message: "IP must be at least 2 characters."
    })
    .max(30, {
      message: "IP must not be longer than 30 characters."
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
  file: z
    .any()
    .refine(file => file instanceof File, {
      message: "Invalid file upload."
    })
    .refine(files => files.length === 1, "You must upload a file.")
    .refine(files => files[0]?.name.endsWith(".pem"), "Only .pem files are allowed.")
    .refine(files => files[0]?.size <= 5 * 1024 * 1024, "File size must be less than 5MB"),
  saveInformation: z.boolean()
});

type AccountFormValues = z.infer<typeof accountFormSchema>;

// This can come from your database or API.
const defaultValues: Partial<AccountFormValues> = {
  // Example default values if needed
};

interface ServerFormProp {
  currentServerNumber: number;
  onSubmit: (data: AccountFormValues) => void;
  defaultValues?: any;
}

export const ServerForm: React.FunctionComponent<ServerFormProp> = ({ currentServerNumber, onSubmit, defaultValues = {} }) => {
  console.log(defaultValues);
  const form = useForm<AccountFormValues>({
    // resolver: zodResolver(accountFormSchema), // Uncomment if using Zod schema validation
    defaultValues
  });

  const [selectedFile, setSelectedFile] = useState({ name: "" });

  const submitForm = (formValues: any) => {
    onSubmit(formValues);
    form.reset();
  };

  const fileChange = (event, field) => {
    field.onChange(event.target.files);
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(event.target.files[0]);
      defaultValues.file = [];
      defaultValues.file[0] = event.target.files[0];
    }
  };

  return (
    <div className="flex flex-col items-center pt-10">
      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-bold">
            {currentServerNumber === 0 && "Control Plane Machine Access"}
            {currentServerNumber !== 0 && "Node Access"}
          </h3>
          <p className="text-muted-foreground text-sm">Enter the required details for your control plane setup</p>
        </div>
        <div>
          <Separator />
        </div>
        <div>
          <Form {...form}>
            {/* Pass form.handleSubmit(onSubmit) to form's onSubmit */}
            <form onSubmit={form.handleSubmit(submitForm)} className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <FormField
                    control={form.control}
                    name="ip"
                    render={({ field }) => (
                      <FormItem className="flex flex-col space-y-2">
                        <FormLabel>
                          {currentServerNumber === 0 && "Public IP"}
                          {currentServerNumber !== 0 && "Private IP"}
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="Input your IP" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div>
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
                  Choose how you would like to provide your credentials
                </p>
                <div className="rounded-md border">
                  <Tabs defaultValue={defaultValues.file && defaultValues?.file[0]?.name ? "file" : "password"} className="space-y-4 p-4">
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
                              <Input placeholder="Input your password" type="password" {...field} />
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
                            <FormLabel>Password File</FormLabel>
                            <FormControl>
                              <Input id="file" type="file" onChange={e => fileChange(e, field)} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <p className="pl-2 pt-4 text-sm">
                        Selected file : {defaultValues.file && defaultValues?.file[0] ? defaultValues?.file[0]?.name : selectedFile.name}
                      </p>
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
                  <p className="text-sm">You can apply information from Control Plane 1 to all remaining nodes by checking the option below.</p>
                  <div>
                    {/* <Checkbox id="options" />
                    <label htmlFor="options" className="pl-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Yes
                    </label> */}

                    <FormField
                      control={form.control}
                      name="saveInformation"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <Checkbox
                              id="saveInformation"
                              checked={field.value} // Ensure the checkbox reflects the form state
                              onCheckedChange={field.onChange} // Update the form state on change
                            />
                          </FormControl>
                          <FormLabel htmlFor="saveInformation" className="text-sm font-medium leading-none">
                            Yes
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormMessage />
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
