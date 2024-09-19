"use client";
import {
  Button,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  Input,
  Separator,
  Select,
  SelectItem,
  SelectTrigger,
  SelectContent
} from "@akashnetwork/ui/components";
import React, { useState } from "react";
import { Form, useForm, useFieldArray, Controller } from "react-hook-form";
import { PlusIcon, TrashIcon } from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { providerAttributesFormValuesSchema } from "../../types/providerAttributes";

// Extract keys and their corresponding schemas from providerAttributesFormValuesSchema
const attributeSchemas = providerAttributesFormValuesSchema.shape;
const attributeKeys = Object.keys(attributeSchemas);

interface ProviderAttributesProps {
  stepChange: (providerInformation: ProviderFormValues) => void;
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

export const ProviderAttributes: React.FunctionComponent<ProviderAttributesProps> = ({ stepChange }) => {
  const form = useForm<ProviderFormValues>({
    resolver: zodResolver(providerFormSchema),
    defaultValues: {
      attributes: [{ key: "", value: "", customKey: "" }]
    }
  });

  const { control } = form;

  const { fields, append, remove } = useFieldArray({
    control,
    name: "attributes"
  });

  const onSubmit = (data: ProviderFormValues) => {
    stepChange(data);
  };

  return (
    <div className="flex w-full flex-col items-center pt-10">
      <div className="w-full max-w-2xl space-y-6">
        <div>
          <h3 className="text-xl font-bold">Provider Attributes</h3>
          <p className="text-muted-foreground text-sm">Please enter your provider attributes.</p>
        </div>
        <div>
          <Separator />
        </div>
        <div>
          <Form {...form} onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <h4 className="mb-2 text-lg font-semibold">Attributes</h4>
              {fields.map((field, index) => {
                const selectedKeys = form.watch("attributes").map(attr => attr.key);
                const availableKeys = attributeKeys.filter(key => !selectedKeys.includes(key) || key === field.key || key === "unknown-attributes");

                return (
                  <div key={field.id} className="mb-2 flex space-x-2">
                    <Controller
                      control={form.control}
                      name={`attributes.${index}.key`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Select value={field.value} onValueChange={value => field.onChange(value)}>
                              <SelectTrigger>{field.value || "Select Key"}</SelectTrigger>
                              <SelectContent>
                                {availableKeys.map(key => (
                                  <SelectItem key={key} value={key}>
                                    {key}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
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
                      render={({ field }) => {
                        const key = form.watch(`attributes.${index}.key`);
                        const schema = attributeSchemas[key] || z.string().min(1, "Value is required");
                        return (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input placeholder="Value" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />
                    <Button type="button" variant="outline" size="icon" onClick={() => remove(index)}>
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
              <Button type="button" variant="outline" size="sm" onClick={() => append({ key: "", value: "", customKey: "" })}>
                <PlusIcon className="mr-2 h-4 w-4" />
                Add Attribute
              </Button>
            </div>
            <div className="">
              <Separator />
            </div>
            <div className="flex justify-end">
              <Button type="submit">Submit</Button>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
};
