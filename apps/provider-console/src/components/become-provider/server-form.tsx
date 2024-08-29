"use client";
import {
  Alert,
  AlertDescription,
  AlertTitle,
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
import restClient from "@src/utils/restClient";
import { Loader2 } from "lucide-react";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const baseSchema = z.object({
  ip: z.string().min(2, { message: "IP must be at least 2 characters." }).max(30, { message: "IP must not be longer than 30 characters." }),
  port: z.number().optional(),
  username: z.string(),
  saveInformation: z.boolean().optional()
});

const passwordSchema = baseSchema.extend({
  authType: z.literal("password"),
  password: z.string().min(1, "Password is required")
});

const fileSchema = baseSchema.extend({
  authType: z.literal("file"),
  file: z.any().refine(files => files?.length === 1, "You must upload a file."),
  passphrase: z.string().optional()
});

const accountFormSchema = z.discriminatedUnion("authType", [passwordSchema, fileSchema]);

type AccountFormValues = z.infer<typeof accountFormSchema>;

interface ServerFormProp {
  currentServerNumber: number;
  onSubmit: (data: AccountFormValues) => void;
  defaultValues?: any;
}

export const ServerForm: React.FunctionComponent<ServerFormProp> = ({ currentServerNumber, onSubmit, defaultValues }) => {
  console.log(defaultValues);
  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      ...defaultValues,
      authType: defaultValues.file && defaultValues?.file[0]?.name ? "file" : "password"
    }
  });

  const [selectedFile, setSelectedFile] = useState({ name: "" });

  const [verificationError, setVerificationError] = useState<{ message: string; details: string[] } | null>(null);
  const [verificationResult, setVerificationResult] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const submitForm = async (formValues: any) => {
    setIsVerifying(true);
    // Clear any existing errors
    setVerificationError(null);
    setVerificationResult(null);
    try {
      const formData = new FormData();
      formData.append("hostname", formValues.ip);
      if (!formValues.port) formValues.port = 22;
      formData.append("port", formValues.port);
      formData.append("username", formValues.username);
      if (formValues.password) {
        formData.append("password", formValues.password);
      }
      if (formValues.file && formValues.file[0]) {
        formData.append("keyfile", formValues.file[0]);
      }
      if (formValues.passphrase) {
        formData.append("passphrase", formValues.passphrase);
      }

      const response = await restClient.post("/verify/control-machine", formData, {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      });

      setVerificationResult(response.data);

      if (response.data.success) {
        onSubmit(formValues);
      } else {
        // Handle verification failure
        setVerificationError({
          message: response.data.detail?.message || "Verification failed",
          details: response.data.detail?.details || []
        });
      }
    } catch (error: any) {
      console.error("Error during verification:", error);
      setVerificationError({
        message: error.response?.data?.detail?.message || "An error occurred during verification.",
        details: error.response?.data?.detail?.details || []
      });
    } finally {
      setIsVerifying(false);
    }
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
                        <Input
                          type="number"
                          placeholder="22"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                        />
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
                <Tabs
                  defaultValue={defaultValues.file && defaultValues?.file[0]?.name ? "file" : "password"}
                  className="space-y-4 p-4"
                  onValueChange={value => form.setValue("authType", value as "password" | "file")}
                >
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
                    <FormField
                      control={form.control}
                      name="passphrase"
                      render={({ field }) => (
                        <FormItem className="mt-4 flex flex-col">
                          <FormLabel>Passphrase (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter passphrase (if any)" type="password" {...field} />
                          </FormControl>
                          <FormDescription>If your key file is encrypted with a passphrase, enter it here.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TabsContent>
                </Tabs>
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={isVerifying}>
                {isVerifying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Next"
                )}
              </Button>
            </div>
            <div className="flex justify-start">
              {verificationError && (
                <Alert variant="destructive" className="w-full">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>
                    <p>{verificationError.message}</p>
                    {verificationError.details?.length > 0 && (
                      <ul className="mt-2 list-disc pl-5">
                        {verificationError.details.map((detail, index) => (
                          <li key={index}>{detail}</li>
                        ))}
                      </ul>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>
            {currentServerNumber === 0 && (
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
            )}
          </form>
        </Form>
      </div>
    </div>
  );
};
