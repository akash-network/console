import { ProviderList } from "@src/components/providers/ProviderList";

function ProvidersPage() {
  return <ProviderList />;
}

export async function getServerSideProps({ params }) {
  return {
    props: {}
  };
}

export default ProvidersPage;
