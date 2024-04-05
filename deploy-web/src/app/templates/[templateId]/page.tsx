import { UrlService } from "@src/utils/urlUtils";
import { Metadata, ResolvingMetadata } from "next";
import { TemplateDetail } from "./TemplateDetail";
import { ApiTemplate, ApiTemplateCategory } from "@src/types";
import { BASE_API_MAINNET_URL } from "@src/utils/constants";
import { getShortText } from "@src/hooks/useShortText";

interface ITemplateDetailPageProps {
  params: { templateId: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export async function generateMetadata({ params: { templateId } }: ITemplateDetailPageProps, parent: ResolvingMetadata): Promise<Metadata> {
  const url = `https://deploy.cloudmos.io${UrlService.templates()}`;
  const template = await fetchTemplateDetail(templateId);

  return {
    title: `Template detail${template ? " " + template?.name : ""}`,
    description: getShortText(template.summary || "", 140),
    alternates: {
      canonical: url
    },
    openGraph: {
      url
    }
  };
}

async function fetchTemplateDetail(templateId: string): Promise<ApiTemplate> {
  const response = await fetch(`${BASE_API_MAINNET_URL}/templates`);

  if (!response.ok) {
    // This will activate the closest `error.js` Error Boundary
    throw new Error("Error fetching template detail data");
  }

  const data = (await response.json()) as ApiTemplateCategory[];
  const categories = data.filter(x => (x.templates || []).length > 0);
  const templates = categories.flatMap(x => x.templates);
  const template = templates.find(x => x.id === templateId);

  return template as ApiTemplate;
}

export default async function TemplateDetailPage({ params: { templateId } }: ITemplateDetailPageProps) {
  const template = await fetchTemplateDetail(templateId);

  return <TemplateDetail templateId={templateId} template={template} />;
}
