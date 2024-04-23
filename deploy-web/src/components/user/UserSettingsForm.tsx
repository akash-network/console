import { NextSeo } from "next-seo";
import { LabelValue } from "@src/components/shared/LabelValue";
import { useEffect, useState } from "react";
import axios from "axios";
import { useSaveSettings } from "@src/queries/useSettings";
import { useCustomUser } from "@src/hooks/useCustomUser";
import { UserSettings } from "@src/types/user";
import { Controller, useForm } from "react-hook-form";
import { event } from "nextjs-google-analytics";
import { AnalyticsEvents } from "@src/utils/analytics";
import { UserProfileLayout } from "@src/components/user/UserProfileLayout";
import Spinner from "@src/components/shared/Spinner";
import { FormPaper } from "@src/components/sdl/FormPaper";
import { Button } from "@src/components/ui/button";
import { Alert } from "@src/components/ui/alert";
import { CheckCircle } from "iconoir-react";
import { MdHighlightOff } from "react-icons/md";
import { Switch } from "@src/components/ui/switch";
import { Input, InputWithIcon, Textarea } from "@src/components/ui/input";
import Layout from "../layout/Layout";

type Props = {};

export const UserSettingsForm: React.FunctionComponent<Props> = ({}) => {
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
    if (user && username && username.length >= 3 && username.length <= 40 && username !== user.username) {
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
    <Layout isLoading={isLoading}>
      <NextSeo title={user?.username} />
      <UserProfileLayout page="settings" username={user?.username} bio={user?.bio}>
        {isLoading || !user ? (
          <div className="flex items-center justify-center p-8">
            <Spinner size="large" />
          </div>
        ) : (
          <FormPaper>
            <form onSubmit={handleSubmit(onSubmit)}>
              <LabelValue label="Email" value={user.email} />
              <LabelValue
                label="Username"
                value={
                  <>
                    <div className="flex items-center">
                      <Input
                        className="mr-2"
                        disabled={isFormDisabled}
                        // error={!!errors.username}
                        {...register("username", {
                          required: "Username is required",
                          minLength: { value: 3, message: "Username must be at least 3 characters long" },
                          maxLength: { value: 40, message: "Username must be at most 40 characters long" },
                          pattern: { value: /^[a-zA-Z0-9_-]*$/, message: "Username can only contain letters, numbers, dashes and underscores" }
                        })}
                      />
                      {isCheckingAvailability && <Spinner size="small" />}
                      <span className="flex flex-shrink-0 items-center whitespace-nowrap text-xs">
                        {!isCheckingAvailability && isAvailable && (
                          <>
                            <CheckCircle className="text-green-600" />
                            &nbsp;Username is available
                          </>
                        )}
                        {!isCheckingAvailability && isAvailable === false && (
                          <>
                            <MdHighlightOff className="text-destructive" />
                            &nbsp;Username is not available
                          </>
                        )}
                      </span>
                    </div>
                    {errors.username && (
                      <Alert className="mt-2" variant="destructive">
                        {errors.username.message}
                      </Alert>
                    )}
                  </>
                }
              />
              <LabelValue
                label="Subscribed to newsletter"
                value={
                  <div className="flex items-center">
                    <Controller
                      name="subscribedToNewsletter"
                      control={control}
                      render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
                    />
                  </div>
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
              <LabelValue label="Bio" value={<Textarea disabled={isFormDisabled} rows={4} className="w-full" {...register("bio")} />} />

              <LabelValue
                label="Youtube"
                value={
                  <InputWithIcon
                    disabled={isFormDisabled}
                    className="w-full"
                    {...register("youtubeUsername")}
                    startIcon={<div>https://www.youtube.com/c/</div>}
                    // startAdornment={<InputAdornment position="start">https://www.youtube.com/c/</InputAdornment>}
                  />
                }
              />
              <LabelValue
                label="X"
                value={
                  <InputWithIcon
                    disabled={isFormDisabled}
                    className="w-full"
                    {...register("twitterUsername")}
                    startIcon={<div>https://x.com/</div>}
                    // startAdornment={<InputAdornment position="start">https://twitter.com/</InputAdornment>}
                  />
                }
              />
              <LabelValue
                label="Github"
                value={
                  <InputWithIcon
                    disabled={isFormDisabled}
                    className="w-full"
                    {...register("githubUsername")}
                    startIcon={<div>https://github.com/</div>}
                    // startAdornment={<InputAdornment position="start">https://github.com/</InputAdornment>}
                  />
                }
              />

              <Button type="submit" disabled={!canSave || isSaving}>
                {isSaving ? <Spinner size="small" /> : "Save"}
              </Button>
            </form>
          </FormPaper>
        )}
      </UserProfileLayout>
    </Layout>
  );
};
