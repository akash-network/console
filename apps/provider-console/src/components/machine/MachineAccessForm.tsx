import React from "react";
import { useForm } from "react-hook-form";
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
  Separator,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { readFileAsBase64 } from "../../utils/files";

// Form validation schema
const machineAccessSchema = z.object({
  hostname: z.string().min(1, "Hostname is required"),
  port: z.number().min(1).max(65535).default(22),
  username: z.string().min(1, "Username is required"),
  authType: z.enum(["password", "file"]),
  password: z.string().optional(),
  file: z.any().optional(), // File object
  passphrase: z.string().optional(),
  saveInformation: z.boolean().optional()
});

export type MachineAccessFormValues = z.infer<typeof machineAccessSchema>;

export interface MachineAccess {
  hostname: string;
  port: number;
  username: string;
  password?: string;
  keyfile?: string; // base64 encoded file content
  file?: File | null; // actual file object
  passphrase?: string;
  saveInformation?: boolean;
}

export interface MachineAccessFormProps {
  onSubmit: (formData: MachineAccess) => Promise<void>;
  defaultValues?: Partial<MachineAccess>;
  submitLabel?: string;
  showSaveConfig?: boolean;
  isPublicIP?: boolean;
  disabled?: boolean;
  isVerifying?: boolean;
  error?: { message: string; details: string[] } | null;
}

export const MachineAccessForm: React.FC<MachineAccessFormProps> = ({
  onSubmit,
  defaultValues,
  submitLabel = "Next",
  showSaveConfig = false,
  isPublicIP = false,
  disabled = false,
  isVerifying = false,
  error = null
}) => {
  const form = useForm<MachineAccessFormValues>({
    resolver: zodResolver(machineAccessSchema),
    defaultValues: {
      hostname: defaultValues?.hostname || "",
      port: defaultValues?.port || 22,
      username: defaultValues?.username || "root",
      authType: defaultValues?.keyfile ? "file" : "password",
      password: defaultValues?.password,
      passphrase: defaultValues?.passphrase,
      saveInformation: false
    }
  });

  const handleSubmit = async (values: MachineAccessFormValues) => {
    try {
      const formData: MachineAccess = {
        hostname: values.hostname,
        port: values.port || 22,
        username: values.username,
        saveInformation: values.saveInformation
      };

      if (values.password) {
        formData.password = values.password;
      }

      const fileContent = values.file && values.file[0] ? await readFileAsBase64(values.file[0]) : defaultValues?.keyfile;

      if (fileContent) {
        formData.keyfile = fileContent;
        formData.file = values.file?.[0] || null;
      }

      if (values.passphrase) {
        formData.passphrase = values.passphrase;
      }

      await onSubmit(formData);
    } catch (error) {
      console.error("Form submission error:", error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <FormField
              control={form.control}
              name="hostname"
              render={({ field }) => (
                <FormItem className="flex flex-col space-y-2">
                  <FormLabel>{isPublicIP ? "Public IP" : "Private IP"}</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter a valid IPv4 address" {...field} disabled={disabled} />
                  </FormControl>
                  <FormDescription>Must be a valid IPv4 address</FormDescription>
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
                      disabled={disabled}
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
              render={() => (
                <FormItem className="flex flex-col space-y-2">
                  <FormLabel>SSH Username</FormLabel>
                  <FormControl>
                    <Input value="root" disabled readOnly />
                  </FormControl>
                  <FormDescription>The username must be &quot;root&quot; for proper setup.</FormDescription>
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
              onValueChange={value => {
                form.setValue("authType", value as "password" | "file");
                if (value === "password") {
                  form.setValue("file", undefined);
                  form.setValue("passphrase", undefined);
                } else {
                  form.setValue("password", undefined);
                }
              }}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="password" disabled={disabled}>
                  Password
                </TabsTrigger>
                <TabsTrigger value="file" disabled={disabled}>
                  Key File
                </TabsTrigger>
              </TabsList>

              <TabsContent value="password" className="p-4">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem className="flex flex-col space-y-2">
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} disabled={disabled} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="file" className="space-y-4 p-4">
                <FormField
                  control={form.control}
                  name="file"
                  render={({ field: { value, onChange, ...field } }) => (
                    <FormItem className="flex flex-col space-y-2">
                      <FormLabel>Private Key</FormLabel>
                      <FormControl>
                        <Input
                          type="file"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            onChange(file ? [file] : undefined);
                          }}
                          {...field}
                          disabled={disabled}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="passphrase"
                  render={({ field }) => (
                    <FormItem className="flex flex-col space-y-2">
                      <FormLabel>Passphrase (Optional)</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} disabled={disabled} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {showSaveConfig && (
          <div className="flex items-center space-x-2">
            <FormField
              control={form.control}
              name="saveInformation"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-2">
                  <FormControl>
                    <Checkbox id="saveInformation" checked={field.value} onCheckedChange={field.onChange} disabled={disabled} />
                  </FormControl>
                  <FormLabel htmlFor="saveInformation" className="text-sm font-medium leading-none">
                    Apply this config to all nodes?
                  </FormLabel>
                </FormItem>
              )}
            />
          </div>
        )}

        {error && (
          <div className="rounded-md border border-red-500 bg-red-50 p-4 text-red-700">
            <p className="font-medium">{error.message}</p>
            {error.details?.length > 0 && (
              <ul className="mt-2 list-inside list-disc">
                {error.details.map((detail, index) => (
                  <li key={index}>{detail}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <Separator />

        <div className="flex justify-end">
          <Button type="submit" disabled={disabled || isVerifying}>
            {isVerifying ? "Verifying..." : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
};
