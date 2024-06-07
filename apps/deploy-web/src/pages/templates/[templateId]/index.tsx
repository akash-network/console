import axios from "axios";

import { TemplateDetail } from "@src/components/templates/TemplateDetail";
import { ApiTemplate } from "@src/types";
import { BASE_API_MAINNET_URL } from "@src/utils/constants";

type Props = {
  templateId: string;
  template: ApiTemplate;
};

const TemplateDetailPage: React.FunctionComponent<Props> = ({ templateId, template }) => {
  return <TemplateDetail templateId={templateId} template={template} />;
};

export default TemplateDetailPage;

export async function getServerSideProps({ params }) {
  const response = await axios.get(`${BASE_API_MAINNET_URL}/templates`);
  const categories = response.data.filter(x => (x.templates || []).length > 0);
  categories.forEach(c => {
    c.templates.forEach(t => (t.category = c.title));
  });
  const templates = categories.flatMap(x => x.templates);
  const template = templates.find(x => x.id === params?.templateId);

  return {
    props: {
      templateId: params?.templateId,
      template
    }
  };
}
