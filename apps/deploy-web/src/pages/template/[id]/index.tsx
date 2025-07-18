import { getSession } from "@auth0/nextjs-auth0";
import { z } from "zod";

import { UserTemplate } from "@src/components/templates/UserTemplate";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import type { ITemplate } from "@src/types";

type Props = {
  id: string;
  template: ITemplate;
};

const TemplatePage: React.FunctionComponent<Props> = ({ id, template }) => {
  return <UserTemplate id={id} template={template} />;
};

export default TemplatePage;

export const getServerSideProps = defineServerSideProps({
  route: "/template/[id]",
  schema: z.object({
    params: z.object({
      id: z.string()
    })
  }),
  async handler({ params, services, req, res }) {
    const session = await getSession(req, res);
    let config = {};

    if (session) {
      config = {
        headers: {
          Authorization: session ? `Bearer ${session.accessToken}` : ""
        }
      };
    }
    const response = await services.consoleApiHttpClient.get(`${services.apiUrlService.getBaseApiUrlFor("mainnet")}/user/template/${params.id}`, config);

    return {
      props: {
        id: params.id,
        template: response.data
      }
    };
  }
});
