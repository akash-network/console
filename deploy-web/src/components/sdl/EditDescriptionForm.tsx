"use client";
import { ReactNode, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import axios from "axios";
import { FormPaper } from "./FormPaper";
import { Button } from "../ui/button";
import Spinner from "../shared/Spinner";
import { Label } from "../ui/label";
import { Textarea } from "../ui/input";
import { useSnackbar } from "notistack";
import { Snackbar } from "../shared/Snackbar";

type Props = {
  id: string;
  description: string;
  children?: ReactNode;
  onCancel: () => void;
  onSave: (description: string) => void;
};

type DescriptionFormValues = {
  description: string;
};

export const EditDescriptionForm: React.FunctionComponent<Props> = ({ id, description, onCancel, onSave }) => {
  const formRef = useRef<HTMLFormElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { enqueueSnackbar } = useSnackbar();
  const { handleSubmit, control } = useForm<DescriptionFormValues>({
    defaultValues: {
      description: description || ""
    }
  });

  const onSubmit = async (data: DescriptionFormValues) => {
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
      <form onSubmit={handleSubmit(onSubmit)} ref={formRef} autoComplete="off">
        <Controller
          control={control}
          name={`description`}
          render={({ field }) => (
            <div>
              <Label>Description</Label>
              <Textarea
                aria-label="Description"
                rows={10}
                placeholder="Write your guide on how to use this template here!"
                className="mt-2 w-full px-4 py-2 text-sm"
                value={field.value}
                spellCheck={false}
                onChange={field.onChange}
              />
            </div>
          )}
        />

        <div className="mt-2 flex items-center justify-end space-x-4">
          <Button onClick={onCancel} variant="ghost">
            Cancel
          </Button>
          <Button color="secondary" variant="default" type="submit">
            {isSaving ? <Spinner size="small" /> : "Save"}
          </Button>
        </div>
      </form>
    </FormPaper>
  );
};
