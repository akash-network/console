import { getSession } from "@auth0/nextjs-auth0";
import { UserTemplate } from "@src/components/templates/UserTemplate";
import { ITemplate } from "@src/types";
import { BASE_API_MAINNET_URL } from "@src/utils/constants";
import axios from "axios";

type Props = {
  id: string;
  template: ITemplate;
};

const TemplatePage: React.FunctionComponent<Props> = ({ id, template }) => {
  return <UserTemplate id={id} template={template} />;
};

export default TemplatePage;

export const getServerSideProps = async function getServerSideProps({ params, req, res }) {
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
};
