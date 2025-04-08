/**
 * Calculates the optimal distribution of control plane and worker nodes
 * for a Kubernetes cluster based on best practices.
 *
 * @param totalNewNodes - Number of new nodes being added
 * @param existingControlPlane - Number of existing control plane nodes
 * @param existingWorkers - Number of existing worker nodes
 * @returns Object containing the number of new control plane and worker nodes
 */
export const calculateNodeDistribution = (totalNewNodes: number, existingControlPlane: number = 0, existingWorkers: number = 0) => {
  const totalNodes = totalNewNodes + existingControlPlane + existingWorkers;
  let targetControlPlane = 0;

  // Calculate target number of control plane nodes for the entire cluster
  // Following Kubernetes best practices:
  // - Small clusters (<=3 nodes): 1 control plane
  // - Medium clusters (<=5 nodes): 3 control planes
  // - Large clusters: 3 control planes + 2 additional for every 50 nodes, up to 11
  if (totalNodes <= 3) {
    targetControlPlane = 1;
  } else if (totalNodes <= 5) {
    targetControlPlane = 3;
  } else {
    const baseControlPlane = 3;
    const additionalPairs = Math.floor((totalNodes - 1) / 50);
    targetControlPlane = Math.min(baseControlPlane + additionalPairs * 2, 11); // Cap at 11 control plane nodes
  }

  // Calculate how many new control plane nodes we need
  const newControlPlaneNeeded = Math.max(0, targetControlPlane - existingControlPlane);
  const newControlPlane = Math.min(newControlPlaneNeeded, totalNewNodes);
  const newWorkers = totalNewNodes - newControlPlane;

  return {
    newControlPlane,
    newWorkers,
    totalControlPlane: existingControlPlane + newControlPlane,
    totalWorkers: existingWorkers + newWorkers
  };
};

/**
 * Utility function to check if having an even number of control plane nodes
 * is valid (it should always be odd for optimal consensus)
 *
 * @param controlPlaneCount - Number of control plane nodes
 * @returns Boolean indicating if the count is valid (odd)
 */
export const isValidControlPlaneCount = (controlPlaneCount: number): boolean => {
  if (controlPlaneCount <= 0) return false;
  return controlPlaneCount % 2 === 1; // Control plane count should be odd
};
