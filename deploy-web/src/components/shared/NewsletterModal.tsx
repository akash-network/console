import React, { useEffect, useState } from "react";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import { makeStyles } from "tss-react/mui";
import { Popup } from "./Popup";
import { useCustomUser } from "@src/hooks/useCustomUser";
import axios from "axios";
import { useSnackbar } from "notistack";
import { Snackbar } from "./Snackbar";
import { isAfter, add } from "date-fns";

export const useStyles = makeStyles()(theme => ({}));

export type Props = {};

const latestSubscribeCheckKey = "latestSubscribeCheck";

export const NewsletterModal: React.FunctionComponent<Props> = ({}) => {
  const { user, isLoading: isLoadingUser } = useCustomUser();
  const { enqueueSnackbar } = useSnackbar();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const latestSubscribeCheck = localStorage.getItem(latestSubscribeCheckKey);
    // Only ask if the user is not subscribed and hasn't been asked for 7 days
    if (
      !!user &&
      !isLoadingUser &&
      !user.subscribedToNewsletter &&
      (!latestSubscribeCheck || isAfter(new Date(), add(new Date(latestSubscribeCheck), { days: 7 })))
    ) {
      setIsOpen(true);
    }
  }, []);

  const onClose = () => {
    localStorage.setItem(latestSubscribeCheckKey, new Date().toString());
    setIsOpen(false);
  };

  const onSubscribe = async () => {
    try {
      setIsSaving(true);
      await axios.post("/api/proxy/user/subscribeToNewsletter");

      enqueueSnackbar(<Snackbar title="Successfully subscribed to newsletter!" iconVariant="success" />, {
        variant: "success"
      });

      setIsSaving(false);
      onClose();
    } catch (error) {
      console.log(error);
      setIsSaving(false);
    }
  };

  return (
    <Popup fullWidth open={isOpen} variant="custom" title="Subscribe to newsletter" actions={[]} onClose={onClose} maxWidth="xs" enableCloseOnBackdropClick>
      <Typography variant="body1" sx={{ marginBottom: "1rem" }}>
        Hey!
        <br />
        <br /> Thank you for creating an account. 🎉
        <br /> Looks like you're not subscribed to our newsletter!
      </Typography>

      <Typography variant="caption">We only send emails about product updates and occasional promotions (no spam)</Typography>

      <Box sx={{ marginTop: "1.5rem" }}>
        <Button color="secondary" variant="contained" fullWidth onClick={onSubscribe} disabled={isSaving} size="large">
          {isSaving ? <CircularProgress color="secondary" size="1.5rem" /> : "Subscribe now!"}
        </Button>
      </Box>
    </Popup>
  );
};
