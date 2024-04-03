import { EditProviderContainer } from "./EditProviderContainer";

interface IProviderDetailPageProps {
  params: { owner: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

{
  /* <NextSeo title={`Edit Provider ${owner}`} /> */
}

export default async function EditProviderPage({ params: { owner }, searchParams: { network } }: IProviderDetailPageProps) {
  return <EditProviderContainer owner={owner} />;
}
