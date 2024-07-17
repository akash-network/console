"use client";
import { Dispatch, ReactNode, SetStateAction, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Alert, FormField, FormInput, Label, Popup, RadioGroup, RadioGroupItem, Snackbar } from "@akashnetwork/ui/components";
import { event } from "nextjs-google-analytics";
import { useSnackbar } from "notistack";

import { MustConnect } from "@src/components/shared/MustConnect";
import { useCustomUser } from "@src/hooks/useCustomUser";
import { getShortText } from "@src/hooks/useShortText";
import { useSaveUserTemplate } from "@src/queries/useTemplateQuery";
import { EnvironmentVariable, ITemplate, Service } from "@src/types";
import { AnalyticsEvents } from "@src/utils/analytics";
import { z } from "zod";

type Props = {
  services: Service[];
  templateMetadata: ITemplate;
  getTemplateData: () => Partial<ITemplate>;
  setTemplateMetadata: Dispatch<SetStateAction<ITemplate>>;
  onClose: () => void;
  children?: ReactNode;
};

const formSchema = z.object({
  title: z.string({
    message: "Title is required."
  }),
  visibility: z.enum(["private", "public"])
});
type FormValues = z.infer<typeof formSchema>;

export const SaveTemplateModal: React.FunctionComponent<Props> = ({ onClose, getTemplateData, templateMetadata, setTemplateMetadata, services }) => {
  const [publicEnvs, setPublicEnvs] = useState<EnvironmentVariable[]>([]);
  const { enqueueSnackbar } = useSnackbar();
  const formRef = useRef<HTMLFormElement>(null);
  const { user, isLoading: isLoadingUser } = useCustomUser();
  const isRestricted = !isLoadingUser && !user;
  const isCurrentUserTemplate = !isRestricted && user?.sub === templateMetadata?.userId;
  const { mutate: saveTemplate } = useSaveUserTemplate(!isCurrentUserTemplate);
  const { handleSubmit, control, setValue } = useForm<FormValues>({
    defaultValues: {
      title: "",
      visibility: "private"
    }
  });

  useEffect(() => {
    const envs = services.some(s => s.env?.some(e => !e.isSecret))
      ? services.reduce((cur: EnvironmentVariable[], prev) => cur.concat([...(prev.env?.filter(e => !e.isSecret) as EnvironmentVariable[])]), [])
      : [];
    setPublicEnvs(envs);

    if (templateMetadata && isCurrentUserTemplate) {
      setValue("title", templateMetadata.title);
      setValue("visibility", templateMetadata.isPublic ? "public" : "private");
    }
  }, []);

  const onSubmit = async (data: FormValues) => {
    const template = getTemplateData();

    await saveTemplate({ ...template, title: data.title, isPublic: data.visibility !== "private" });

    const newTemplateMetadata = { ...templateMetadata, title: data.title, isPublic: data.visibility !== "private" };
    if (!isCurrentUserTemplate) {
      newTemplateMetadata.username = user.username || "";
      newTemplateMetadata.userId = user.sub || "";
    }
    setTemplateMetadata(newTemplateMetadata);

    enqueueSnackbar(<Snackbar title="Template saved!" iconVariant="success" />, {
      variant: "success"
    });

    if (newTemplateMetadata.id) {
      event(AnalyticsEvents.UPDATE_SDL_TEMPLATE, {
        category: "sdl_builder",
        label: "Update SDL template"
      });
    } else {
      event(AnalyticsEvents.CREATE_SDL_TEMPLATE, {
        category: "sdl_builder",
        label: "Create SDL template"
      });
    }

    onClose();
  };

  const onSave = () => {
    formRef.current?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
  };

  return (
    <Popup
      fullWidth
      open={true}
      variant="custom"
      title="Save Template"
      actions={[
        {
          label: "Cancel",
          color: "primary",
          variant: "text",
          side: "left",
          onClick: onClose
        },
        {
          label: isCurrentUserTemplate ? "Save" : "Save As",
          color: "secondary",
          variant: "default",
          side: "right",
          disabled: isRestricted,
          onClick: onSave
        }
      ]}
      onClose={onClose}
      maxWidth="xs"
      enableCloseOnBackdropClick
    >
      <div className="pt-2">
        {isRestricted ? (
          <MustConnect message="To save a template" />
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} ref={formRef} autoComplete="off">
            <FormField
              control={control}
              name="title"
              render={({ field }) => (
                <FormInput type="text" label="Title" className="mb-4 w-full" value={field.value || ""} onChange={event => field.onChange(event.target.value)} />
              )}
            />

            <FormField
              control={control}
              name={`visibility`}
              render={({ field }) => (
                <RadioGroup defaultValue="private" value={field.value} onValueChange={field.onChange} className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="private" id="private" />
                    <Label htmlFor="private">Private</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="public" id="public" />
                    <Label htmlFor="public">Public</Label>
                  </div>
                </RadioGroup>
              )}
            />

            {publicEnvs.length > 0 && (
              <Alert variant="warning" className="mt-4 max-h-[150px] overflow-y-auto">
                You have {publicEnvs.length} public environment variables. Are you sure you don't need to hide them as secret?
                <ul className="break-all p-0">
                  {publicEnvs.map((e, i) => (
                    <li key={i}>
                      {e.key}={getShortText(e.value, 30)}
                    </li>
                  ))}
                </ul>
              </Alert>
            )}
          </form>
        )}
      </div>
    </Popup>
  );
};
