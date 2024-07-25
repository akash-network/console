"use client";
import { ReactNode, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Button, Form, FormField, FormItem, FormMessage, Snackbar, Spinner, Textarea } from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormLabel } from "@mui/material";
import axios from "axios";
import { useSnackbar } from "notistack";
import { z } from "zod";

import { FormPaper } from "./FormPaper";

type Props = {
  id: string;
  description: string;
  children?: ReactNode;
  onCancel: () => void;
  onSave: (description: string) => void;
};

const formSchema = z.object({
  description: z.string().min(3, "Description must be at least 3 characters long")
});
type FormValues = z.infer<typeof formSchema>;

export const EditDescriptionForm: React.FunctionComponent<Props> = ({ id, description, onCancel, onSave }) => {
  const formRef = useRef<HTMLFormElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { enqueueSnackbar } = useSnackbar();
  const form = useForm<FormValues>({
    defaultValues: {
      description: description || ""
    },
    resolver: zodResolver(formSchema)
  });
  const { handleSubmit, control } = form;

  const onSubmit = async (data: FormValues) => {
    setIsSaving(true);
    await axios.post("/api/proxy/user/saveTemplateDesc", {
      id: id,
      description: data.description
    });

    enqueueSnackbar(<Snackbar title="Description saved!" iconVariant="success" />, {
      variant: "success"
    });

    onSave(data.description);
  };

  return (
    <FormPaper className="mt-4">
      <Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)} ref={formRef} autoComplete="off">
          <FormField
            control={control}
            name={`description`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <Textarea
                  aria-label="Description"
                  rows={10}
                  placeholder="Write your guide on how to use this template here!"
                  className="mt-2 w-full px-4 py-2 text-sm"
                  value={field.value}
                  spellCheck={false}
                  onChange={field.onChange}
                />
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="mt-2 flex items-center justify-end space-x-4">
            <Button onClick={onCancel} variant="ghost">
              Cancel
            </Button>
            <Button variant="default" type="submit">
              {isSaving ? <Spinner size="small" /> : "Save"}
            </Button>
          </div>
        </form>
      </Form>
    </FormPaper>
  );
};
