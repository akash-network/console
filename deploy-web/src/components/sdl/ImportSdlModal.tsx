import { ReactNode, useEffect, useState } from "react";
import { Popup } from "../shared/Popup";
import { Alert, Box, Typography, useTheme } from "@mui/material";
import { useSnackbar } from "notistack";
import Editor from "@monaco-editor/react";
import { Timer } from "@src/utils/timer";
import { importSimpleSdl } from "@src/utils/sdl/sdlImport";
import { UseFormSetValue } from "react-hook-form";
import { SdlBuilderFormValues, Service } from "@src/types";
import { Snackbar } from "../shared/Snackbar";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import { event } from "nextjs-google-analytics";
import { AnalyticsEvents } from "@src/utils/analytics";
import { useProviderAttributesSchema } from "@src/queries/useProvidersQuery";

type Props = {
  setValue: UseFormSetValue<SdlBuilderFormValues>;
  onClose: () => void;
  children?: ReactNode;
};

export const ImportSdlModal: React.FunctionComponent<Props> = ({ onClose, setValue }) => {
  const theme = useTheme();
  const [sdl, setSdl] = useState("");
  const [parsingError, setParsingError] = useState(null);
  const { enqueueSnackbar } = useSnackbar();
  const { data: providerAttributesSchema } = useProviderAttributesSchema();

  useEffect(() => {
    const timer = Timer(500);

    timer.start().then(() => {
      createAndValidateSdl(sdl);
    });

    return () => {
      if (timer) {
        timer.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdl]);

  const createAndValidateSdl = (yamlStr: string) => {
    try {
      if (!yamlStr) return null;

      const services = importSimpleSdl(yamlStr, providerAttributesSchema);

      setParsingError(null);

      return services;
    } catch (err) {
      if (err.name === "YAMLException" || err.name === "CustomValidationError") {
        setParsingError(err.message);
      } else if (err.name === "TemplateValidation") {
        setParsingError(err.message);
      } else {
        setParsingError("Error while parsing SDL file");
        // setParsingError(err.message);
        console.error(err);
      }
    }
  };

  const onImport = () => {
    const result = createAndValidateSdl(sdl);
    console.log(result);

    if (!result) return;

    setValue("services", result as Service[]);

    enqueueSnackbar(<Snackbar title="Import success!" iconVariant="success" />, {
      variant: "success",
      autoHideDuration: 4000
    });

    event(AnalyticsEvents.IMPORT_SDL, {
      category: "sdl_builder",
      label: "Import SDL"
    });

    onClose();
  };

  return (
    <Popup
      fullWidth
      open={true}
      variant="custom"
      title="Import SDL"
      actions={[
        {
          label: "Close",
          color: "primary",
          variant: "text",
          side: "left",
          onClick: onClose
        },
        {
          label: "Import",
          color: "secondary",
          variant: "contained",
          side: "right",
          disabled: !sdl || !!parsingError,
          onClick: onImport
        }
      ]}
      onClose={onClose}
      maxWidth="md"
      enableCloseOnBackdropClick
    >
      <Typography
        variant="h6"
        sx={{
          marginBottom: ".5rem",
          color: theme.palette.mode === "dark" ? theme.palette.grey[400] : theme.palette.grey[600],
          display: "flex",
          alignItems: "center"
        }}
      >
        Paste your sdl here to import <ArrowDownwardIcon sx={{ marginLeft: "1rem" }} />
      </Typography>
      <Box sx={{ marginBottom: ".5rem" }}>
        <Editor
          height="500px"
          defaultLanguage="yaml"
          value={sdl}
          onChange={value => setSdl(value)}
          theme={theme.palette.mode === "dark" ? "vs-dark" : "light"}
        />
      </Box>
      {parsingError && (
        <Alert severity="error" variant="outlined">
          {parsingError}
        </Alert>
      )}
    </Popup>
  );
};
