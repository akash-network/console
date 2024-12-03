"use client";
import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
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
  Separator,
  Spinner,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAtom } from "jotai/react";
import { z } from "zod";

import { useControlMachine } from "@src/context/ControlMachineProvider";
import { useWallet } from "@src/context/WalletProvider";
import providerProcessStore from "@src/store/providerProcessStore";
import { ControlMachineWithAddress } from "@src/types/controlMachine";
import restClient from "@src/utils/restClient";
import { ResetProviderForm } from "./ResetProviderProcess";

const baseSchema = z.object({
  hostname: z.string().min(2, { message: "IP must be at least 2 characters." }).max(30, { message: "IP must not be longer than 30 characters." }),
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
  onComplete: () => void;
  editMode?: boolean;
  controlMachine?: ControlMachineWithAddress | null;
}

export const ServerForm: React.FC<ServerFormProp> = ({ currentServerNumber, onComplete, editMode = false, controlMachine }) => {
  const [providerProcess, setProviderProcess] = useAtom(providerProcessStore.providerProcessAtom);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [storedFileContent, setStoredFileContent] = useState<string | null>(null);
  const { setControlMachine } = useControlMachine();
  const { address } = useWallet();

  const getDefaultValues = () => {
    if (currentServerNumber === 0 || !providerProcess?.storeInformation) {
      return {
        hostname: "",
        authType: "password",
        username: "root",
        port: 22
      };
    }

    const firstServer = providerProcess.machines[0]?.access;
    return {
      ...firstServer,
      hostname: "",
      authType: firstServer.file ? "file" : "password",
      password: firstServer.password,
      username: "root"
    };
  };

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: editMode ? controlMachine?.access : (getDefaultValues() as any)
  });

  useEffect(() => {
    if (currentServerNumber > 0 && providerProcess?.storeInformation) {
      const firstServer = editMode ? controlMachine?.access : providerProcess.machines[0]?.access;
      if (firstServer?.file) {
        setStoredFileContent(typeof firstServer.file === "string" ? firstServer.file : null);
        form.setValue("authType", "file");
      }
    }
  }, [currentServerNumber, providerProcess, form, editMode, controlMachine]);

  const [verificationError, setVerificationError] = useState<{ message: string; details: string[] } | null>(null);
  const [, setVerificationResult] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const submitForm = async (formValues: any) => {
    setIsVerifying(true);
    setVerificationError(null);
    setVerificationResult(null);
    try {
      const jsonData: any = {
        hostname: formValues.hostname,
        port: formValues.port || 22,
        username: formValues.username
      };

      if (formValues.password) {
        jsonData.password = formValues.password;
      }

      if (formValues.file && formValues.file[0]) {
        jsonData.keyfile = storedFileContent;
      } else if (storedFileContent) {
        jsonData.keyfile = storedFileContent;
      }

      if (formValues.passphrase) {
        jsonData.passphrase = formValues.passphrase;
      }

      let response: any;
      if (currentServerNumber === 0 || editMode) {
        response = await restClient.post("/verify/control-machine", jsonData, {
          headers: { "Content-Type": "application/json" }
        });
      } else {
        const controlMachine = providerProcess?.machines[0]?.access;
        const keyfile = controlMachine.file ? controlMachine.file : undefined;
        const payload = {
          control_machine: {
            hostname: controlMachine.hostname,
            port: controlMachine.port || 22,
            username: controlMachine.username,
            password: controlMachine.password,
            keyfile: keyfile,
            passphrase: controlMachine.passphrase
          },
          worker_node: jsonData
        };

        response = await restClient.post("/verify/control-and-worker", payload, {
          headers: { "Content-Type": "application/json" }
        });
      }

      if (response.status === "success") {
        const machine = {
          access: {
            ...formValues,
            file: formValues.file && formValues.file[0] ? await readFileAsBase64(formValues.file[0]) : storedFileContent
          },
          systemInfo: response.data.system_info
        };
        if (!editMode) {
          const machines = [...(providerProcess?.machines ?? [])];
          machines[currentServerNumber] = machine;

          setProviderProcess({
            ...providerProcess,
            machines,
            storeInformation: currentServerNumber === 0 ? formValues.saveInformation : providerProcess?.storeInformation,
            process: providerProcess.process
          });
        } else {
          setControlMachine({
            address,
            ...machine
          });
        }
        onComplete();
      }
    } catch (error: any) {
      setVerificationError({
        message: error.response?.data?.detail?.error?.message || "An error occurred during verification.",
        details: error.response?.data?.detail?.error?.details?.details || []
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const fileChange = (event, field) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = e => {
        const base64Content = e.target?.result as string;
        setStoredFileContent(base64Content);
        setSelectedFile(file);
        field.onChange([file]);
      };
      reader.readAsDataURL(file);
    }
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold">
          {editMode ? "Control Machine Access" : currentServerNumber === 0 ? "Control Plane Machine Access" : "Node Access"}
        </h3>
        <p className="text-muted-foreground text-sm">Enter the required details for your {editMode ? "control machine" : "control plane setup"}</p>
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
                  name="hostname"
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
                          onChange={e => field.onChange(e.target.value ? parseInt(e.target.value, 10) : undefined)}
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
                      <FormDescription>The username must be "root" for proper setup.</FormDescription>
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
                  defaultValue={form.getValues("authType")}
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
                      Selected file: {selectedFile ? selectedFile.name : storedFileContent ? "Using stored file" : "No file selected"}
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
              <div className="flex w-full justify-between">
                <div className="flex justify-start">{!editMode && <ResetProviderForm />}</div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={isVerifying}>
                    {isVerifying ? (
                      <>
                        <Spinner size="small" className="mr-2"/>
                        Verifying...
                      </>
                    ) : editMode ? (
                      "Update"
                    ) : (
                      "Next"
                    )}
                  </Button>
                </div>
              </div>
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
            {currentServerNumber === 0 && !editMode && (
              <div className="rounded-md border">
                <div className="space-y-2 p-4">
                  <h4 className="text-lg font-bold">Heads up!</h4>
                  <p className="text-sm">You can apply information from Control Plane 1 to all remaining nodes by checking the option below.</p>
                  <div>
                    <FormField
                      control={form.control}
                      name="saveInformation"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <Checkbox id="saveInformation" checked={field.value} onCheckedChange={field.onChange} />
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
