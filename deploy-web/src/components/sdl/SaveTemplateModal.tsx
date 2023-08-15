import { Dispatch, ReactNode, SetStateAction, useEffect, useRef, useState } from "react";
import { makeStyles } from "tss-react/mui";
import { Popup } from "../shared/Popup";
import { Alert, Box, FormControlLabel, Radio, RadioGroup, TextField, useTheme } from "@mui/material";
import { useSnackbar } from "notistack";
import { Controller, useForm } from "react-hook-form";
import { ITemplate, SdlSaveTemplateFormValues, Service } from "@src/types";
import { useSaveUserTemplate } from "@src/queries/useTemplateQuery";
import { Snackbar } from "../shared/Snackbar";
import { MustConnect } from "../shared/MustConnect";
import { useCustomUser } from "@src/hooks/useCustomUser";
import { getShortText } from "@src/hooks/useShortText";
import { event } from "nextjs-google-analytics";
import { AnalyticsEvents } from "@src/utils/analytics";

type Props = {
  services: Service[];
  templateMetadata: ITemplate;
  getTemplateData: () => Partial<ITemplate>;
  setTemplateMetadata: Dispatch<SetStateAction<ITemplate>>;
  onClose: () => void;
  children?: ReactNode;
};

const useStyles = makeStyles()(theme => ({
  formControl: {
    marginBottom: theme.spacing(1.5)
  },
  textField: {
    width: "100%"
  }
}));

export const SaveTemplateModal: React.FunctionComponent<Props> = ({ onClose, getTemplateData, templateMetadata, setTemplateMetadata, services }) => {
  const { classes } = useStyles();
  const [publicEnvs, setPublicEnvs] = useState([]);
  const { enqueueSnackbar } = useSnackbar();
  const formRef = useRef<HTMLFormElement>();
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
    const envs = services.some(s => s.env.some(e => !e.isSecret)) ? services.reduce((cur, prev) => cur.concat([...prev.env.filter(e => !e.isSecret)]), []) : [];
    console.log(envs);
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
      newTemplateMetadata.userId = user.sub;
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
    formRef.current.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
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
          variant: "contained",
          side: "right",
          disabled: isRestricted,
          onClick: onSave
        }
      ]}
      onClose={onClose}
      maxWidth="xs"
      enableCloseOnBackdropClick
    >
      <Box sx={{ paddingTop: ".5rem" }}>
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
                  className={classes.formControl}
                  fullWidth
                  color="secondary"
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
                <RadioGroup defaultValue="private" value={field.value} onChange={field.onChange}>
                  <FormControlLabel value="private" control={<Radio color="secondary" />} label="Private" />
                  <FormControlLabel value="public" control={<Radio color="secondary" />} label="Public" />
                </RadioGroup>
              )}
            />

            {publicEnvs.length > 0 && (
              <Alert severity="warning" sx={{ marginTop: "1rem", maxHeight: "150px", overflowY: "auto" }}>
                You have {publicEnvs.length} public environment variables. Are you sure you don't need to hide them as secret?
                <Box component="ul" sx={{ padding: 0, wordBreak: "break-all" }}>
                  {publicEnvs.map((e, i) => (
                    <li key={i}>
                      {e.key}={getShortText(e.value, 30)}
                    </li>
                  ))}
                </Box>
              </Alert>
            )}
          </form>
        )}
      </Box>
    </Popup>
  );
};
