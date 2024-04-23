"use client";
import { Dispatch, ReactNode, SetStateAction, useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { EnvironmentVariable, ITemplate, SdlSaveTemplateFormValues, Service } from "@src/types";
import { useSaveUserTemplate } from "@src/queries/useTemplateQuery";
import { useCustomUser } from "@src/hooks/useCustomUser";
import { getShortText } from "@src/hooks/useShortText";
import { event } from "nextjs-google-analytics";
import { AnalyticsEvents } from "@src/utils/analytics";
import { useToast } from "@src/components/ui/use-toast";
import { Popup } from "@src/components/shared/Popup";
import { Alert } from "@src/components/ui/alert";
import { MustConnect } from "@src/components/shared/MustConnect";
import TextField from "@mui/material/TextField";
import { RadioGroup, RadioGroupItem } from "@src/components/ui/radio-group";
import { Label } from "@src/components/ui/label";

type Props = {
  services: Service[];
  templateMetadata: ITemplate;
  getTemplateData: () => Partial<ITemplate>;
  setTemplateMetadata: Dispatch<SetStateAction<ITemplate>>;
  onClose: () => void;
  children?: ReactNode;
};

export const SaveTemplateModal: React.FunctionComponent<Props> = ({ onClose, getTemplateData, templateMetadata, setTemplateMetadata, services }) => {
  const [publicEnvs, setPublicEnvs] = useState<EnvironmentVariable[]>([]);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const { user, isLoading: isLoadingUser } = useCustomUser();
  const isRestricted = !isLoadingUser && !user;
  const isCurrentUserTemplate = !isRestricted && user?.sub === templateMetadata?.userId;
  const { mutate: saveTemplate } = useSaveUserTemplate(!isCurrentUserTemplate);
  const { handleSubmit, control, setValue } = useForm<SdlSaveTemplateFormValues>({
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

  const onSubmit = async (data: SdlSaveTemplateFormValues) => {
    const template = getTemplateData();

    await saveTemplate({ ...template, title: data.title, isPublic: data.visibility !== "private" });

    const newTemplateMetadata = { ...templateMetadata, title: data.title, isPublic: data.visibility !== "private" };
    if (!isCurrentUserTemplate) {
      newTemplateMetadata.username = user.username;
      newTemplateMetadata.userId = user.sub || "";
    }
    setTemplateMetadata(newTemplateMetadata);

    toast({ title: "Template saved!", variant: "success" });

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
            <Controller
              control={control}
              rules={{ required: "Title is required." }}
              name="title"
              render={({ field, fieldState }) => (
                <TextField
                  type="text"
                  variant="outlined"
                  label="Title"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  className="mb-4"
                  fullWidth
                  size="small"
                  value={field.value || ""}
                  onChange={event => field.onChange(event.target.value)}
                />
              )}
            />

            <Controller
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
