import { SettingsContainer } from "@src/components/settings/SettingsContainer";

type Props = {};

const SettingsPage: React.FunctionComponent<Props> = ({}) => {
  return <SettingsContainer />;
};

export default SettingsPage;

export async function getServerSideProps({ params }) {
  return {
    props: {}
  };
}
