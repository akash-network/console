import { useTheme } from "@mui/material/styles";
import Layout from "@src/components/layout/Layout";
import { Title } from "@src/components/shared/Title";
import PageContainer from "@src/components/shared/PageContainer";
import { NextSeo } from "next-seo";
import axios from "axios";
import { BASE_API_MAINNET_URL, RouteStepKeys } from "@src/utils/constants";
import { ITemplate } from "@src/types";
import { UrlService } from "@src/utils/urlUtils";
import Link from "next/link";
import { Box, Button, Paper, Typography, IconButton, Snackbar } from "@mui/material";
import { LeaseSpecDetail } from "@src/components/shared/LeaseSpecDetail";
import { bytesToShrink } from "@src/utils/unitUtils";
import { roundDecimal } from "@src/utils/mathHelpers";
import { useEffect, useState } from "react";
import { getSession, getServerSidePropsWrapper } from "@auth0/nextjs-auth0";
import { useCustomUser } from "@src/hooks/useCustomUser";
import DeleteIcon from "@mui/icons-material/Delete";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import { Popup } from "@src/components/shared/Popup";
import { useDeleteTemplate } from "@src/queries/useTemplateQuery";
import { useRouter } from "next/router";
import EditIcon from "@mui/icons-material/Edit";
import { EditDescriptionForm } from "@src/components/sdl/EditDescriptionForm";
import { event } from "nextjs-google-analytics";
import { AnalyticsEvents } from "@src/utils/analytics";
import { useAtom } from "jotai";
import sdlStore from "@src/store/sdlStore";
import { UserFavoriteButton } from "@src/components/shared/UserFavoriteButton";

type Props = {
  id: string;
  template: ITemplate;
};

const TemplatePage: React.FunctionComponent<Props> = ({ id, template }) => {
  const theme = useTheme();
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
            variant: "contained",
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

      <NextSeo title={template.title} />
      {/* <SdlViewer sdl={template.sdl} onClose={() => setIsViewingSdl(false)} open={isViewingSdl} /> */}

      <PageContainer>
        <Box sx={{ display: "flex", alignItems: "baseline", marginBottom: "1rem" }}>
          <Title value={<>{template.title}</>} sx={{ margin: "0 !important" }} />
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
        </Box>

        <Box sx={{ display: "flex", alignItems: "center" }}>
          <Button
            variant="contained"
            color="secondary"
            size="medium"
            endIcon={<RocketLaunchIcon fontSize="small" />}
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
          </Button>

          <Button
            href={UrlService.sdlBuilder(template.id)}
            component={Link}
            variant="text"
            color="secondary"
            size="small"
            sx={{ marginLeft: "1rem" }}
            onClick={() => {
              event(AnalyticsEvents.CLICK_EDIT_SDL_TEMPLATE, {
                category: "sdl_builder",
                label: "Click on edit SDL template"
              });
            }}
          >
            Edit
          </Button>

          <Box sx={{ marginLeft: "1rem" }}>
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
          </Box>

          {isCurrentUserTemplate && (
            <IconButton sx={{ marginLeft: "1rem" }} onClick={() => setIsShowingDelete(true)}>
              <DeleteIcon />
            </IconButton>
          )}
        </Box>

        <Box sx={{ marginTop: "1rem" }}>
          <LeaseSpecDetail sx={{ display: "inline-flex", minWidth: "120px", marginRight: 1 }} type="cpu" value={template.cpu / 1_000} />
          <LeaseSpecDetail
            sx={{ display: "inline-flex", minWidth: "145px", marginRight: 1 }}
            type="ram"
            value={`${roundDecimal(_ram.value, 1)} ${_ram.unit}`}
          />
          <LeaseSpecDetail
            sx={{ display: "inline-flex", minWidth: "145px", marginRight: 1 }}
            type="storage"
            value={`${roundDecimal(_storage.value, 1)} ${_storage.unit}`}
          />
        </Box>

        {isEditingDescription ? (
          <EditDescriptionForm id={id} description={description} onCancel={() => setIsEditingDescription(false)} onSave={onDescriptionSave} />
        ) : (
          <Paper sx={{ padding: "1rem", marginTop: "1rem", position: "relative", whiteSpace: "pre-wrap" }}>
            {isCurrentUserTemplate && (
              <Box sx={{ position: "absolute", top: ".5rem", right: ".5rem" }}>
                <IconButton onClick={() => setIsEditingDescription(true)}>
                  <EditIcon />
                </IconButton>
              </Box>
            )}

            {description ? description : <Typography variant="caption">No description...</Typography>}
          </Paper>
        )}
      </PageContainer>
    </Layout>
  );
};

export default TemplatePage;

export const getServerSideProps = getServerSidePropsWrapper(async function getServerSideProps({ params, req, res }) {
  try {
    const session = getSession(req, res);
    let config = {};

    if (session) {
      config = {
        headers: {
          Authorization: session ? `Bearer ${session.accessToken}` : ""
        }
      };
    }

    const response = await axios.get(`${BASE_API_MAINNET_URL}/user/template/${params?.id}`, config);

    return {
      props: {
        id: params?.id,
        template: response.data
      }
    };
  } catch (error) {
    if (error.response?.status === 404 || error.response?.status === 400) {
      return {
        notFound: true
      };
    } else {
      throw error;
    }
  }
});
