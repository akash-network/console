import Layout from "@src/components/layout/Layout";
import { NextSeo } from "next-seo";
import { Alert, Box, Button, CircularProgress, InputAdornment, OutlinedInput, Paper, Switch, TextField } from "@mui/material";
import { LabelValue } from "@src/components/shared/LabelValue";
import { useEffect, useState } from "react";
import axios from "axios";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import HighlightOffIcon from "@mui/icons-material/HighlightOff";
import { useSaveSettings } from "@src/queries/useSettings";
import { useCustomUser } from "@src/hooks/useCustomUser";
import { UserSettings } from "@src/types/user";
import { Controller, useForm } from "react-hook-form";
import { useRouter } from "next/router";
import { UrlService } from "@src/utils/urlUtils";
import { event } from "nextjs-google-analytics";
import { AnalyticsEvents } from "@src/utils/analytics";
import { withCustomPageAuthRequired } from "@src/utils/withCustomPageAuthRequired";
import { UserProfileLayout } from "@src/app/profile/[username]/UserProfileLayout";

type Props = {
  username: string;
};

const UserSettingsPage: React.FunctionComponent<Props> = ({}) => {
  const { user, isLoading } = useCustomUser();
  const [isCheckingAvailability, setIsCheckingAvailability] = useState<boolean>(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const {
    getValues,
    register,
    handleSubmit,
    setValue,
    control,
    watch,
    formState: { isDirty, errors }
  } = useForm<UserSettings>({
    defaultValues: {
      username: "",
      subscribedToNewsletter: false,
      bio: "",
      youtubeUsername: "",
      twitterUsername: "",
      githubUsername: ""
    }
  });
  const { mutate: saveSettings, isLoading: isSaving } = useSaveSettings();
  const { username } = watch();
  const router = useRouter();

  const isFormDisabled = isLoading || isSaving;
  const canSave = !isFormDisabled && isDirty && isAvailable !== false;

  useEffect(() => {
    if (user) {
      setValue("username", user.username);
      setValue("subscribedToNewsletter", user.subscribedToNewsletter);
      setValue("bio", user.bio);
      setValue("youtubeUsername", user.youtubeUsername);
      setValue("twitterUsername", user.twitterUsername);
      setValue("githubUsername", user.githubUsername);
    }
  }, [user?.username, user?.subscribedToNewsletter, user?.bio, user?.youtubeUsername, user?.twitterUsername, user?.githubUsername]);

  useEffect(() => {
    if (user && username.length >= 3 && username.length <= 40 && username !== user.username) {
      const timeoutId = setTimeout(async () => {
        setIsCheckingAvailability(true);
        const response = await axios.get("/api/proxy/user/checkUsernameAvailability/" + username);

        setIsCheckingAvailability(false);
        setIsAvailable(response.data.isAvailable);
      }, 500);

      return () => clearTimeout(timeoutId);
    } else {
      setIsAvailable(null);
    }
  }, [user?.username, username]);

  async function onSubmit() {
    saveSettings(getValues());

    event(AnalyticsEvents.USER_SETTINGS_SAVE, {
      category: "settings",
      label: "Save user settings"
    });
  }

  // function onUpgradeClick(ev) {
  //   ev.preventDefault();

  //   event(AnalyticsEvents.USER_SETTINGS_UPGRADE_PLAN, {
  //     category: "settings",
  //     label: "Click on upgrade plan from user settings"
  //   });

  //   router.push(UrlService.pricing());
  // }

  return (
    <Layout>
      <NextSeo title={user?.username} />

      <UserProfileLayout page="settings" username={user?.username} bio={user?.bio}>
        {isLoading || !user ? (
          <CircularProgress color="secondary" />
        ) : (
          <Paper sx={{ mt: "1rem", padding: "1rem" }} elevation={2}>
            <form onSubmit={handleSubmit(onSubmit)}>
              <LabelValue label="Email" value={user.email} />
              <LabelValue
                label="Username"
                value={
                  <>
                    <Box sx={{ display: "flex", alignItems: "center" }}>
                      <TextField
                        sx={{ marginRight: 2 }}
                        disabled={isFormDisabled}
                        error={!!errors.username}
                        {...register("username", {
                          required: "Username is required",
                          minLength: { value: 3, message: "Username must be at least 3 characters long" },
                          maxLength: { value: 40, message: "Username must be at most 40 characters long" },
                          pattern: { value: /^[a-zA-Z0-9_-]*$/, message: "Username can only contain letters, numbers, dashes and underscores" }
                        })}
                      />
                      {isCheckingAvailability && <CircularProgress color="secondary" size="2rem" />}
                      {!isCheckingAvailability && isAvailable && (
                        <>
                          <CheckCircleIcon color="success" />
                          &nbsp;Username is available
                        </>
                      )}
                      {!isCheckingAvailability && isAvailable === false && (
                        <>
                          <HighlightOffIcon color="error" />
                          &nbsp;Username is not available
                        </>
                      )}
                    </Box>
                    {errors.username && (
                      <Alert sx={{ marginTop: 1 }} severity="error" variant="outlined">
                        {errors.username.message}
                      </Alert>
                    )}
                  </>
                }
              />
              <LabelValue
                label="Subscribed to newsletter"
                value={
                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    <Controller
                      name="subscribedToNewsletter"
                      control={control}
                      render={({ field }) => <Switch checked={field.value} onChange={field.onChange} color="secondary" />}
                    />
                  </Box>
                }
              />
              {/* <LabelValue
                label="Subscription"
                value={
                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    {user.plan.name}
                    {user.planCode === "COMMUNITY" ? (
                      <Button sx={{ marginLeft: 1 }} variant="outlined" color="secondary" onClick={onUpgradeClick}>
                        Upgrade
                      </Button>
                    ) : (
                      <form method="POST" action="/api/proxy/user/manage-subscription">
                        <Button
                          sx={{ marginLeft: 2 }}
                          variant="contained"
                          color="secondary"
                          type="submit"
                          onClick={() => {
                            event(AnalyticsEvents.USER_SETTINGS_MANAGE_BILLING, {
                              category: "settings",
                              label: "Manage billing from user settings"
                            });
                          }}
                        >
                          Manage billing
                        </Button>
                      </form>
                    )}
                  </Box>
                }
              /> */}
              <LabelValue label="Bio" value={<TextField disabled={isFormDisabled} multiline rows={4} fullWidth {...register("bio")} />} />

              <LabelValue
                label="Youtube"
                value={
                  <OutlinedInput
                    disabled={isFormDisabled}
                    fullWidth
                    {...register("youtubeUsername")}
                    startAdornment={<InputAdornment position="start">https://www.youtube.com/c/</InputAdornment>}
                  />
                }
              />
              <LabelValue
                label="Twitter"
                value={
                  <OutlinedInput
                    disabled={isFormDisabled}
                    fullWidth
                    {...register("twitterUsername")}
                    startAdornment={<InputAdornment position="start">https://twitter.com/</InputAdornment>}
                  />
                }
              />
              <LabelValue
                label="Github"
                value={
                  <OutlinedInput
                    disabled={isFormDisabled}
                    fullWidth
                    {...register("githubUsername")}
                    startAdornment={<InputAdornment position="start">https://github.com/</InputAdornment>}
                  />
                }
              />

              {isSaving ? (
                <CircularProgress color="secondary" size="3rem" />
              ) : (
                <Button type="submit" variant="contained" color="secondary" disabled={!canSave}>
                  Save
                </Button>
              )}
            </form>
          </Paper>
        )}
      </UserProfileLayout>
    </Layout>
  );
};

export default UserSettingsPage;

export const getServerSideProps = withCustomPageAuthRequired({
  async getServerSideProps({ params, req, res }) {
    return {
      props: {}
    };
  }
});
