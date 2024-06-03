"use client";
import { useEffect, useState } from "react";
import { Bin, Edit, Rocket } from "iconoir-react";
import { useAtom } from "jotai";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { event } from "nextjs-google-analytics";

import { EditDescriptionForm } from "@src/components/sdl/EditDescriptionForm";
import { LeaseSpecDetail } from "@src/components/shared/LeaseSpecDetail";
import { Popup } from "@src/components/shared/Popup";
import { Title } from "@src/components/shared/Title";
import { UserFavoriteButton } from "@src/components/shared/UserFavoriteButton";
import { Button, buttonVariants } from "@src/components/ui/button";
import { Card, CardContent } from "@src/components/ui/card";
import { useCustomUser } from "@src/hooks/useCustomUser";
import { getShortText } from "@src/hooks/useShortText";
import { useDeleteTemplate } from "@src/queries/useTemplateQuery";
import sdlStore from "@src/store/sdlStore";
import { ITemplate } from "@src/types";
import { AnalyticsEvents } from "@src/utils/analytics";
import { RouteStepKeys } from "@src/utils/constants";
import { roundDecimal } from "@src/utils/mathHelpers";
import { cn } from "@src/utils/styleUtils";
import { bytesToShrink } from "@src/utils/unitUtils";
import { domainName,UrlService } from "@src/utils/urlUtils";
import Layout from "../layout/Layout";
import { CustomNextSeo } from "../shared/CustomNextSeo";

type Props = {
  id: string;
  template: ITemplate;
};

export const UserTemplate: React.FunctionComponent<Props> = ({ id, template }) => {
  const [description, setDescription] = useState("");
  const [isShowingDelete, setIsShowingDelete] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const { user } = useCustomUser();
  const { mutate: deleteTemplate, isLoading: isDeleting } = useDeleteTemplate(id);
  const isCurrentUserTemplate = user?.sub === template.userId;
  const _ram = bytesToShrink(template.ram);
  const _storage = bytesToShrink(template.storage);
  const router = useRouter();
  const [, setDeploySdl] = useAtom(sdlStore.deploySdl);

  useEffect(() => {
    const desc = template.description || "";
    setDescription(desc);
  }, []);

  const onDeleteTemplate = async () => {
    await deleteTemplate();

    event(AnalyticsEvents.DEPLOY_SDL, {
      category: "sdl_builder",
      label: "Delete SDL template from detail"
    });

    router.replace(UrlService.userProfile(template.username));
  };

  const onDeleteClose = () => {
    setIsShowingDelete(false);
  };

  const onDescriptionSave = (desc: string) => {
    setDescription(desc);
    setIsEditingDescription(false);

    event(AnalyticsEvents.SAVE_SDL_DESCRIPTION, {
      category: "sdl_builder",
      label: "Save SDL description"
    });
  };
  return (
    <Layout>
      <CustomNextSeo title={`${template.title}`} url={`${domainName}${UrlService.template(id)}`} description={getShortText(template.description || "", 140)} />

      <Popup
        fullWidth
        variant="custom"
        actions={[
          {
            label: "Close",
            color: "primary",
            variant: "text",
            side: "left",
            onClick: onDeleteClose
          },
          {
            label: "Confirm",
            color: "secondary",
            variant: "default",
            side: "right",
            isLoading: isDeleting,
            onClick: onDeleteTemplate
          }
        ]}
        onClose={onDeleteClose}
        maxWidth="xs"
        enableCloseOnBackdropClick
        open={isShowingDelete}
        title="Delete template"
      >
        Are you sure you want to delete template: "{template.title}"?
      </Popup>

      <div className="mb-4 flex items-baseline">
        <Title className="m-0">{template.title}</Title>
        &nbsp;&nbsp;by&nbsp;
        <span
          onClick={() => {
            event(AnalyticsEvents.CLICK_SDL_PROFILE, {
              category: "sdl_builder",
              label: "Click on SDL user profile in template detail"
            });
          }}
        >
          <Link href={UrlService.userProfile(template.username)}>{template.username}</Link>
        </span>
      </div>

      <div className="flex items-center space-x-4">
        <Button
          onClick={() => {
            event(AnalyticsEvents.DEPLOY_SDL, {
              category: "sdl_builder",
              label: "Deploy SDL from template detail"
            });

            setDeploySdl({
              title: "",
              category: "",
              code: "",
              description: "",
              content: template.sdl
            });

            router.push(UrlService.newDeployment({ step: RouteStepKeys.editDeployment }));
          }}
        >
          Deploy
          <Rocket className="ml-2 rotate-45 text-sm" />
        </Button>

        <Link
          href={UrlService.sdlBuilder(template.id)}
          className={cn(buttonVariants({ variant: "text" }))}
          onClick={() => {
            event(AnalyticsEvents.CLICK_EDIT_SDL_TEMPLATE, {
              category: "sdl_builder",
              label: "Click on edit SDL template"
            });
          }}
        >
          Edit
        </Link>

        <UserFavoriteButton
          isFavorite={template.isFavorite}
          id={id}
          onAddFavorite={() => {
            event(AnalyticsEvents.ADD_SDL_FAVORITE, {
              category: "sdl_builder",
              label: "Add SDL to favorites"
            });
          }}
          onRemoveFavorite={() => {
            event(AnalyticsEvents.REMOVE_SDL_FAVORITE, {
              category: "sdl_builder",
              label: "Remove SDL from favorites"
            });
          }}
        />

        {isCurrentUserTemplate && (
          <Button size="icon" variant="ghost" onClick={() => setIsShowingDelete(true)}>
            <Bin />
          </Button>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center space-x-6">
        <LeaseSpecDetail type="cpu" value={template.cpu / 1_000} />
        <LeaseSpecDetail type="ram" value={`${roundDecimal(_ram.value, 1)} ${_ram.unit}`} />
        <LeaseSpecDetail type="storage" value={`${roundDecimal(_storage.value, 1)} ${_storage.unit}`} />
      </div>

      {isEditingDescription ? (
        <EditDescriptionForm id={id} description={description} onCancel={() => setIsEditingDescription(false)} onSave={onDescriptionSave} />
      ) : (
        <Card className="relative mt-4 whitespace-pre-wrap">
          <CardContent className="p-4">
            {isCurrentUserTemplate && (
              <div className="absolute right-2 top-2">
                <Button onClick={() => setIsEditingDescription(true)} size="icon" variant="ghost">
                  <Edit />
                </Button>
              </div>
            )}

            {description ? description : <p className="text-sm text-muted-foreground">No description...</p>}
          </CardContent>
        </Card>
      )}
    </Layout>
  );
};
