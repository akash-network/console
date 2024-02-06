import { NewDeploymentContainer } from "./NewDeploymentContainer";

// TODO: Title based on the step
// export async function generateMetadata({ params: { snapshot: snapshotUrlParam } }: IGraphProps, parent: ResolvingMetadata): Promise<Metadata> {
//   const snapshot = urlParamToSnapshot(snapshotUrlParam as SnapshotsUrlParam);
//   const title = getTitle(snapshot as Snapshots);

//   return {
//     title: title
//   };
// }

export default function NewDeploymentPage() {
  return <NewDeploymentContainer />;
}
