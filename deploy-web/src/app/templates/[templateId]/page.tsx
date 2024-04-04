import { UrlService } from "@src/utils/urlUtils";
import { Metadata } from "next";
import { TemplateDetail } from "./TemplateDetail";
import { ApiTemplate, ApiTemplateCategory } from "@src/types";
import { BASE_API_MAINNET_URL } from "@src/utils/constants";

{
  /* <CustomNextSeo
        title={`Template detail${_template ? " " + _template?.name : ""}`}
        url={`https://deploy.cloudmos.io${UrlService.templateDetails(templateId)}`}
        description={getShortText(_template.summary || "", 140)}
      /> */
}

interface ITemplateDetailPageProps {
  params: { templateId: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export async function generateMetadata(): Promise<Metadata> {
  const url = `https://deploy.cloudmos.io${UrlService.templates()}`;

  return {
    title: "Template Gallery",
    description: "Explore all the templates made by the community to easily deploy any docker container on the Akash Network.",
    alternates: {
      canonical: url
    },
    openGraph: {
      url
    }
  };
}

// export async function generateMetadata({ params: { dseq } }: IDeploymentDetailPageProps, parent: ResolvingMetadata): Promise<Metadata> {
//   return {
//     title: `Deployment detail #${dseq}`
//   };
// }
async function fetchTemplateDetail(templateId: string): Promise<ApiTemplate> {
  const response = await fetch(`${BASE_API_MAINNET_URL}/templates`);

  if (!response.ok) {
    // This will activate the closest `error.js` Error Boundary
    throw new Error("Error fetching block data");
  }

  const data = (await response.json()) as ApiTemplateCategory[];
  let categories = data.filter(x => (x.templates || []).length > 0);
  // categories.forEach(c => {
  //   c.templates.forEach(t => (t.category = c.title));
  // });
  const templates = categories.flatMap(x => x.templates);
  const template = templates.find(x => x.id === templateId);

  return template as ApiTemplate;
}

export default async function TemplateDetailPage({ params: { templateId } }: ITemplateDetailPageProps) {
  const template = await fetchTemplateDetail(templateId);

  return <TemplateDetail templateId={templateId} template={template} />;
}
