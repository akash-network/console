"use client";
import {
  Button,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  Input,
  Separator
} from "@akashnetwork/ui/components";
import React from "react";
import { Form, useForm, useFieldArray } from "react-hook-form";
import { PlusIcon, TrashIcon } from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

interface ProviderAttributesProps {
  stepChange: (providerInformation: ProviderFormValues) => void;
}

const providerFormSchema = z.object({
  attributes: z.array(z.object({
    key: z.string().min(1, "Key is required"),
    value: z.string().min(1, "Value is required")
  }))
});

type ProviderFormValues = z.infer<typeof providerFormSchema>;

export const ProviderAttributes: React.FunctionComponent<ProviderAttributesProps> = ({ stepChange }) => {
  const form = useForm<ProviderFormValues>({
    resolver: zodResolver(providerFormSchema),
    defaultValues: {
      attributes: [{ key: "", value: "" }]
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
    <div className="flex flex-col items-center pt-10 w-full">
      <div className="space-y-6 w-full max-w-2xl">
        <div>
          <h3 className="text-xl font-bold">Provider Attributes</h3>
          <p className="text-muted-foreground text-sm">Please enter your provider attributes.</p>
        </div>
        <div>
          <Separator />
        </div>
        <div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <h4 className="text-lg font-semibold mb-2">Attributes</h4>
                {fields.map((field, index) => (
                  <div key={field.id} className="flex space-x-2 mb-2">
                    <FormField
                      control={form.control}
                      name={`attributes.${index}.key`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input placeholder="Key" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
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
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => remove(index)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ key: "", value: "" })}
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Add Attribute
                </Button>
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
