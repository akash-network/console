import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { MdHighlightOff } from "react-icons/md";
import axios from "axios";
import { CheckCircle } from "iconoir-react";
import { NextSeo } from "next-seo";
import { event } from "nextjs-google-analytics";

import { FormPaper } from "@src/components/sdl/FormPaper";
import { LabelValue } from "@src/components/shared/LabelValue";
import Spinner from "@src/components/shared/Spinner";
import { Button, Alert, Input, InputWithIcon, Textarea } from "@akashnetwork/ui/components";
import { Switch } from "@src/components/ui/switch";
import { UserProfileLayout } from "@src/components/user/UserProfileLayout";
import { useCustomUser } from "@src/hooks/useCustomUser";
import { useSaveSettings } from "@src/queries/useSettings";
import { UserSettings } from "@src/types/user";
import { AnalyticsEvents } from "@src/utils/analytics";
import Layout from "../layout/Layout";

export const UserSettingsForm: React.FunctionComponent = () => {
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
              <LabelValue label="Bio" value={<Textarea disabled={isFormDisabled} rows={4} className="w-full" {...register("bio")} />} />

              <LabelValue
                label="Youtube"
                value={
                  <InputWithIcon
                    disabled={isFormDisabled}
                    className="w-full"
                    {...register("youtubeUsername")}
                    startIcon={<div>https://www.youtube.com/c/</div>}
                  />
                }
              />
              <LabelValue
                label="X"
                value={<InputWithIcon disabled={isFormDisabled} className="w-full" {...register("twitterUsername")} startIcon={<div>https://x.com/</div>} />}
              />
              <LabelValue
                label="Github"
                value={
                  <InputWithIcon disabled={isFormDisabled} className="w-full" {...register("githubUsername")} startIcon={<div>https://github.com/</div>} />
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
