import { ReactNode, useRef, useState } from "react";
import { makeStyles } from "tss-react/mui";
import { Controller, useForm } from "react-hook-form";
import { Box, Button, CircularProgress, InputLabel, Paper, TextareaAutosize, useTheme } from "@mui/material";
import axios from "axios";
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

const useStyles = makeStyles()(theme => ({}));

export const EditDescriptionForm: React.FunctionComponent<Props> = ({ id, description, onCancel, onSave }) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const formRef = useRef<HTMLFormElement>();
  const [isSaving, setIsSaving] = useState(false);
  const { enqueueSnackbar } = useSnackbar();
  const {
    handleSubmit,
    reset,
    control,
    formState: { errors },
    trigger,
    watch,
    setValue
  } = useForm<DescriptionFormValues>({
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
    <Paper elevation={1} sx={{ padding: "1rem", marginTop: "1rem" }}>
      <form onSubmit={handleSubmit(onSubmit)} ref={formRef} autoComplete="off">
        <Controller
          control={control}
          name={`description`}
          render={({ field }) => (
            <Box sx={{ marginTop: ".5rem" }}>
              <InputLabel sx={{ marginBottom: ".5rem" }}>Description</InputLabel>
              <TextareaAutosize
                aria-label="Description"
                minRows={10}
                placeholder="Write your guide on how to use this template here!"
                style={{ width: "100%", padding: ".5rem 1rem", fontFamily: "inherit", fontSize: ".8rem", resize: "vertical" }}
                value={field.value}
                spellCheck={false}
                onChange={field.onChange}
              />
            </Box>
          )}
        />

        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginTop: ".5rem" }}>
          <Button onClick={onCancel}>Cancel</Button>
          <Button color="secondary" variant="contained" type="submit" sx={{ marginLeft: "1rem" }}>
            {isSaving ? <CircularProgress size="1rem" sx={{ color: theme.palette.secondary.contrastText }} /> : "Save"}
          </Button>
        </Box>
      </form>
    </Paper>
  );
};
