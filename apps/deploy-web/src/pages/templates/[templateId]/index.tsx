import axios from "axios";

import { TemplateDetail } from "@src/components/templates/TemplateDetail";
import { serverEnvConfig } from "@src/config/server-env.config";
import { ApiTemplate } from "@src/types";

type Props = {
  templateId: string;
  template: ApiTemplate;
};

const TemplateDetailPage: React.FunctionComponent<Props> = ({ templateId, template }) => {
  return <TemplateDetail templateId={templateId} template={template} />;
};

export default TemplateDetailPage;

export async function getServerSideProps({ params }) {
  const response = await axios.get(`${serverEnvConfig.NEXT_PUBLIC_BASE_API_MAINNET_URL}/templates`);
  const categories = response.data.filter(x => (x.templates || []).length > 0);
  categories.forEach(c => {
    c.templates.forEach(t => (t.category = c.title));
  });
  const templates = categories.flatMap(x => x.templates);
  const template = templates.find(x => x.id === params?.templateId);

  if (!template) {
    return {
      notFound: true
    };
  }

  return {
    props: {
      templateId: params?.templateId,
      template
    }
  };
}
