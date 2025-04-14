import { getSession } from "@auth0/nextjs-auth0";

import { UserTemplate } from "@src/components/templates/UserTemplate";
import { serverEnvConfig } from "@src/config/server-env.config";
import { getServerSidePropsWithServices } from "@src/lib/nextjs/getServerSidePropsWithServices";
import type { ITemplate } from "@src/types";

type Props = {
  id: string;
  template: ITemplate;
};

const TemplatePage: React.FunctionComponent<Props> = ({ id, template }) => {
  return <UserTemplate id={id} template={template} />;
};

export default TemplatePage;

export const getServerSideProps = getServerSidePropsWithServices<Props, Pick<Props, "id">>(async ({ params, req, res, services }) => {
  try {
    const session = await getSession(req, res);
    let config = {};

    if (session) {
      config = {
        headers: {
          Authorization: session ? `Bearer ${session.accessToken}` : ""
        }
      };
    }

    const response = await services.axios.get(`${serverEnvConfig.BASE_API_MAINNET_URL}/user/template/${params?.id}`, config);

    return {
      props: {
        id: params!.id,
        template: response.data
      }
    };
  } catch (error: any) {
    if (error.response?.status === 404 || error.response?.status === 400) {
      return {
        notFound: true
      };
    } else {
      throw error;
    }
  }
});
