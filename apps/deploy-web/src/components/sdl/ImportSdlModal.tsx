"use client";
import { ReactNode, useEffect, useState } from "react";
import { UseFormSetValue } from "react-hook-form";
import { Alert, Popup, Snackbar } from "@akashnetwork/ui/components";
import Editor from "@monaco-editor/react";
import { ArrowDown } from "iconoir-react";
import { useTheme } from "next-themes";
import { event } from "nextjs-google-analytics";
import { useSnackbar } from "notistack";

import { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { AnalyticsEvents } from "@src/utils/analytics";
import { importSimpleSdl } from "@src/utils/sdl/sdlImport";
import { Timer } from "@src/utils/timer";

type Props = {
  setValue: UseFormSetValue<SdlBuilderFormValuesType>;
  onClose: () => void;
  children?: ReactNode;
};

export const ImportSdlModal: React.FunctionComponent<Props> = ({ onClose, setValue }) => {
  const [sdl, setSdl] = useState<string | undefined>("");
  const [parsingError, setParsingError] = useState<string | null>(null);
  const { enqueueSnackbar } = useSnackbar();
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const timer = Timer(500);

    timer.start().then(() => {
      createAndValidateSdl(sdl || "");
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

      const services = importSimpleSdl(yamlStr);

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
    const result = createAndValidateSdl(sdl || "");
    console.log(result);

    if (!result) return;

    setValue("services", result as ServiceType[]);

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
          variant: "default",
          side: "right",
          disabled: !sdl || !!parsingError,
          onClick: onImport
        }
      ]}
      onClose={onClose}
      maxWidth="md"
      enableCloseOnBackdropClick
    >
      <h6 className="mb-4 flex items-center text-muted-foreground">
        Paste your sdl here to import <ArrowDown className="ml-4 text-sm" />
      </h6>
      <div className="mb-2">
        <Editor height="500px" defaultLanguage="yaml" value={sdl} onChange={value => setSdl(value)} theme={resolvedTheme === "dark" ? "vs-dark" : "light"} />
      </div>
      {parsingError && (
        <Alert className="mt-4" variant="destructive">
          {parsingError}
        </Alert>
      )}
    </Popup>
  );
};
