import { LeaseListContainer } from "./LeaseListContainer";

interface IProviderDetailPageProps {
  params: { owner: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export default async function ProviderDetailPage({ params: { owner }, searchParams: { network } }: IProviderDetailPageProps) {
  return <LeaseListContainer owner={owner} />;
}
