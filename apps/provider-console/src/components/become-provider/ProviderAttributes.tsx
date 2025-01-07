"use client";

import React from "react";
import { Controller, SubmitHandler, useFieldArray, useForm } from "react-hook-form";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  Separator,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash } from "iconoir-react";
import { useAtom } from "jotai";
import { z } from "zod";

import { useControlMachine } from "@src/context/ControlMachineProvider";
import providerProcessStore, { ProviderAttribute } from "@src/store/providerProcessStore";
import restClient from "@src/utils/restClient";
import { sanitizeMachineAccess } from "@src/utils/sanityUtils";
import { providerAttributesFormValuesSchema } from "../../types/providerAttributes";
import { ResetProviderForm } from "./ResetProviderProcess";

const attributeKeys = Object.keys(providerAttributesFormValuesSchema.shape);

const DEFAULT_ATTRIBUTES = ['host', 'tier'];

interface ProviderAttributesProps {
  existingAttributes?: ProviderAttribute[];
  editMode?: boolean;
  onComplete?: () => void;
}

const providerFormSchema = z.object({
  attributes: z.array(
    z.object({
      key: z.string().min(1, "Key is required"),
      value: z.string().min(1, "Value is required"),
      customKey: z.string().optional()
    })
  )
});

type ProviderFormValues = z.infer<typeof providerFormSchema>;

export const ProviderAttributes: React.FunctionComponent<ProviderAttributesProps> = ({ onComplete, existingAttributes, editMode }) => {
  const [providerProcess, setProviderProcess] = useAtom(providerProcessStore.providerProcessAtom);
  const organizationName = providerProcess.config?.organization;

  const form = useForm<ProviderFormValues>({
    resolver: zodResolver(providerFormSchema),
    defaultValues: {
      attributes: existingAttributes
        ? existingAttributes.map(attr => ({
          key: attributeKeys.includes(attr.key) ? attr.key : "unknown-attributes",
          value: attr.value,
          customKey: attributeKeys.includes(attr.key) ? "" : attr.key
        }))
        : [
          { key: "host", value: "akash", customKey: "" },
          { key: "tier", value: "community", customKey: "" },
          { key: "organization", value: organizationName || "", customKey: "" }
        ]
    }
  });

  const { control } = form;
  const { fields, append, remove } = useFieldArray({
    control,
    name: "attributes"
  });

  const { activeControlMachine } = useControlMachine();

  const [showSuccess, setShowSuccess] = React.useState(false);

  const updateProviderAttributesAndProceed: SubmitHandler<ProviderFormValues> = async data => {
    if (!editMode) {
      const updatedProviderProcess = {
        ...providerProcess,
        attributes: data.attributes.map(attr => ({
          key: attr.key === "unknown-attributes" ? attr.customKey || "" : attr.key || "",
          value: attr.value
        }))
      };
      setProviderProcess(updatedProviderProcess);
      onComplete && onComplete();
    } else {
      const attributes = data.attributes.map(attr => ({
        key: attr.key === "unknown-attributes" ? attr.customKey || "" : attr.key || "",
        value: attr.value
      }));
      const request = {
        control_machine: sanitizeMachineAccess(activeControlMachine),
        attributes
      };

      const response = await restClient.post(`/update-provider-attributes`, request);
      if (response) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 10000);
      }
    }
  };

  return (
    <div className="flex w-full flex-col items-center pt-10">
      <div className="w-full max-w-2xl space-y-6">
        <div>
          <h3 className="text-xl font-bold">{existingAttributes ? "Edit Provider Attributes" : "Provider Attributes"}</h3>
          <p className="text-muted-foreground text-sm">Attributes choosen here will be displayed publicly to the Console.</p>
          <p className="text-muted-foreground text-sm">It will be used for filtering and querying providers during bid process.</p>
        </div>
        <div>
          <Separator />
        </div>
        <div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(updateProviderAttributesAndProceed)} className="space-y-6">
              <div>
                <h4 className="mb-2 text-lg font-semibold">Attributes</h4>
                {fields.map((field, index) => {
                  const selectedKeys = form.watch("attributes").map(attr => attr.key);
                  const availableKeys = attributeKeys.filter(key => !selectedKeys.includes(key) || key === field.key || key === "unknown-attributes");
                  const isDefaultAttribute = DEFAULT_ATTRIBUTES.includes(field.key);

                  return (
                    <div key={field.id} className="mb-2 flex space-x-2">
                      <TooltipProvider>
                        <Controller
                          control={form.control}
                          name={`attributes.${index}.key`}
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormControl>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div>
                                      <Select 
                                        value={field.value} 
                                        onValueChange={value => field.onChange(value)}
                                        disabled={isDefaultAttribute}
                                      >
                                        <SelectTrigger>{field.value || "Select Key"}</SelectTrigger>
                                        <SelectContent>
                                          {availableKeys.map(key => (
                                            <SelectItem key={key} value={key}>
                                              {key}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </TooltipTrigger>
                                  {isDefaultAttribute && (
                                    <TooltipContent>
                                      <p>This is a default attribute and cannot be modified</p>
                                    </TooltipContent>
                                  )}
                                </Tooltip>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </TooltipProvider>
                      {form.watch(`attributes.${index}.key`) === "unknown-attributes" && (
                        <FormField
                          control={form.control}
                          name={`attributes.${index}.customKey`}
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormControl>
                                <Input placeholder="Custom Key" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                      <FormField
                        control={form.control}
                        name={`attributes.${index}.value`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div>
                                    <Input 
                                      placeholder="Value" 
                                      {...field} 
                                      disabled={isDefaultAttribute}
                                    />
                                  </div>
                                </TooltipTrigger>
                                {isDefaultAttribute && (
                                  <TooltipContent>
                                    <p>This is a default attribute and cannot be modified</p>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => remove(index)}
                        disabled={isDefaultAttribute}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
                <Button type="button" variant="outline" size="sm" onClick={() => append({ key: "", value: "", customKey: "" })}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Attribute
                </Button>
              </div>
              <div className="">
                <Separator />
              </div>
              <div className="flex w-full justify-between">
                <div className="flex justify-start">{!editMode && <ResetProviderForm />}</div>
                <div className="flex justify-end">
                  <Button type="submit">{editMode ? "Update Attributes" : "Next"}</Button>
                </div>
              </div>
            </form>
          </Form>
        </div>
        {showSuccess && (
          <Alert>
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>Provider attributes updated successfully</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
};
