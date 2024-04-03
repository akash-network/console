import { ProviderRawData } from "./ProviderRawData";

interface IProviderDetailPageProps {
  params: { owner: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export default async function ProviderRawPage({ params: { owner }, searchParams: { network } }: IProviderDetailPageProps) {
  return <ProviderRawData owner={owner} />;
}
