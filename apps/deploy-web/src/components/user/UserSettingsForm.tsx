import type { FC } from "react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { MdHighlightOff } from "react-icons/md";
import { Alert, Button, Card, CardContent, Form, FormField, FormInput, Spinner, Switch, Textarea } from "@akashnetwork/ui/components";
import { CheckCircle } from "iconoir-react";
import { NextSeo } from "next-seo";
import { z } from "zod";

import { LabelValue } from "@src/components/shared/LabelValue";
import { UserProfileLayout } from "@src/components/user/UserProfileLayout";
import { useServices } from "@src/context/ServicesProvider";
import { useCustomUser } from "@src/hooks/useCustomUser";
import { useSaveSettings } from "@src/queries/useSaveSettings";
import type { CustomUserProfile, UserSettings } from "@src/types/user";
import Layout from "../layout/Layout";

const formSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters long")
    .max(40, "Username must be at most 40 characters long")
    .regex(/^[a-zA-Z0-9_-]*$/, "Username can only contain letters, numbers, dashes and underscores"),
  subscribedToNewsletter: z.boolean().optional(),
  bio: z.string().optional(),
  youtubeUsername: z.string().optional(),
  twitterUsername: z.string().optional(),
  githubUsername: z.string().optional()
});

export const UserSettingsForm: FC<{ user: CustomUserProfile }> = ({ user }) => {
  const { consoleApiHttpClient, analyticsService } = useServices();
  const [isCheckingAvailability, setIsCheckingAvailability] = useState<boolean>(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const { isLoading } = useCustomUser();
  const form = useForm<z.infer<typeof formSchema>>({
    defaultValues: {
      username: "",
      subscribedToNewsletter: false,
      bio: "",
      youtubeUsername: "",
      twitterUsername: "",
      githubUsername: ""
    }
  });
  const {
    getValues,
    register,
    handleSubmit,
    setValue,
    control,
    watch,
    formState: { isDirty, errors }
  } = form;
  const { mutate: saveSettings, isPending: isSaving } = useSaveSettings();
  const { username } = watch();

  const isFormDisabled = isSaving;
  const canSave = !isFormDisabled && isDirty && isAvailable !== false;

  useEffect(() => {
    if (user) {
      setValue("username", user.username || "");
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
        const response = await consoleApiHttpClient.get(`/user/checkUsernameAvailability/${username}`);

        setIsCheckingAvailability(false);
        setIsAvailable(response.data.isAvailable);
      }, 500);

      return () => clearTimeout(timeoutId);
    } else {
      setIsAvailable(null);
    }
  }, [user?.username, username]);

  async function onSubmit() {
    saveSettings(getValues() as UserSettings);

    analyticsService.track("user_settings_save", {
      category: "settings",
      label: "Save user settings"
    });
  }

  return (
    <Layout isLoading={isLoading}>
      <NextSeo title={user?.username} />
      <UserProfileLayout page="settings" username={user.username} bio={user.bio}>
        <Card>
          <CardContent className="p-6">
            <Form {...form}>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <LabelValue label="Email" value={user.email} />
                <LabelValue
                  label="Username"
                  value={
                    <>
                      <div className="flex items-center">
                        <FormField
                          name="username"
                          control={control}
                          render={({ field }) => {
                            return <FormInput {...field} autoFocus className="mr-2" disabled={isFormDisabled} />;
                          }}
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
                <LabelValue label="Bio" value={<Textarea disabled={isFormDisabled} rows={4} inputClassName="w-full" {...register("bio")} />} />

                <LabelValue
                  label="Youtube"
                  value={
                    <FormField
                      name="youtubeUsername"
                      control={control}
                      render={({ field }) => <FormInput {...field} disabled={isFormDisabled} className="w-full" placeholder="https://www.youtube.com/c/" />}
                    />
                  }
                />
                <LabelValue
                  label="X"
                  value={
                    <FormField
                      name="twitterUsername"
                      control={control}
                      render={({ field }) => <FormInput {...field} disabled={isFormDisabled} className="w-full" placeholder="https://x.com/" />}
                    />
                  }
                />
                <LabelValue
                  label="Github"
                  value={
                    <FormField
                      name="githubUsername"
                      control={control}
                      render={({ field }) => <FormInput {...field} disabled={isFormDisabled} className="w-full" placeholder="https://github.com/" />}
                    />
                  }
                />

                <div className="flex justify-end">
                  <Button type="submit" disabled={!canSave || isSaving} size="sm">
                    {isSaving ? <Spinner size="small" /> : "Save"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </UserProfileLayout>
    </Layout>
  );
};
