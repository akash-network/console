"use client";

import React from "react";
import { Controller, SubmitHandler, useFieldArray, useForm } from "react-hook-form";
import {
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
  Separator
} from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash } from "iconoir-react";
import { useAtom } from "jotai";
import { z } from "zod";

import providerProcessStore, { ProviderAttribute } from "@src/store/providerProcessStore";
import { providerAttributesFormValuesSchema } from "../../types/providerAttributes";
import { ResetProviderForm } from "./ResetProviderProcess";

const attributeKeys = Object.keys(providerAttributesFormValuesSchema.shape);

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

export const ProviderAttributes: React.FC<ProviderAttributesProps> = ({ existingAttributes, editMode, onComplete }) => {
  const [providerPricing, setProviderPricing] = useAtom(providerProcessStore.providerProcessAtom);
  const form = useForm<ProviderFormValues>({
    resolver: zodResolver(providerFormSchema),
    defaultValues: {
      attributes: existingAttributes
        ? existingAttributes.map(attr => ({
            key: attributeKeys.includes(attr.key) ? attr.key : "unknown-attributes",
            value: attr.value,
            customKey: attributeKeys.includes(attr.key) ? "" : attr.key
          }))
        : [{ key: "", value: "", customKey: "" }]
    }
  });

  const { control } = form;
  const { fields, append, remove } = useFieldArray({
    control,
    name: "attributes"
  });

  const updateProviderAttributesAndProceed: SubmitHandler<ProviderFormValues> = async data => {
    if (!editMode) {
      const updatedProviderPricing = {
        ...providerPricing,
        attributes: data.attributes.map(attr => ({
          key: attr.key === "unknown-attributes" ? attr.customKey || "" : attr.key || "",
          value: attr.value
        }))
      };
      setProviderPricing(updatedProviderPricing);
      onComplete && onComplete();
    } else {
      const attributes = data.attributes.map(attr => ({
        key: attr.key === "unknown-attributes" ? attr.customKey || "" : attr.key || "",
        value: attr.value
      }));
      console.log("update attributes", attributes);
    }
  };

  return (
    <div className="flex w-full flex-col items-center pt-10">
      <div className="w-full max-w-2xl space-y-6">
        <div>
          <h3 className="text-xl font-bold">{existingAttributes ? "Edit Provider Attributes" : "Provider Attributes"}</h3>
          <p className="text-muted-foreground text-sm">
            {existingAttributes ? "Please update your provider attributes." : "Please enter your provider attributes."}
          </p>
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
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input placeholder="Value" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="button" variant="outline" size="icon" onClick={() => remove(index)}>
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
      </div>
    </div>
  );
};
