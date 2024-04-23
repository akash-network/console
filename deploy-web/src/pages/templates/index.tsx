import { TemplateGallery } from "@src/components/templates/TemplateGallery";

type Props = {};

const TemplateGalleryPage: React.FunctionComponent<Props> = ({}) => {
  return <TemplateGallery />;
};

export default TemplateGalleryPage;

export async function getServerSideProps({ params }) {
  return {
    props: {}
  };
}
