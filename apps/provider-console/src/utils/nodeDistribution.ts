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
 * @deprecated Use isValidEtcdCount instead for more accurate consensus validation
 */
export const isValidControlPlaneCount = (controlPlaneCount: number): boolean => {
  if (controlPlaneCount <= 0) return false;
  return controlPlaneCount % 2 === 1; // Control plane count should be odd
};

/**
 * Checks if a node has the etcd role based on its roles string
 *
 * @param roles - The roles string from the node
 * @returns Boolean indicating if the node has etcd role
 */
export const hasEtcdRole = (roles: string): boolean => {
  return roles.toLowerCase().includes("etcd");
};

/**
 * Utility function to check if having an even number of etcd nodes
 * is valid (it should always be odd for optimal consensus)
 *
 * @param etcdCount - Number of etcd nodes
 * @returns Boolean indicating if the count is valid (odd)
 */
export const isValidEtcdCount = (etcdCount: number): boolean => {
  if (etcdCount <= 0) return false;
  return etcdCount % 2 === 1; // Etcd count should be odd for consensus
};

/**
 * Counts the number of etcd nodes in a list of nodes
 *
 * @param nodes - Array of nodes with roles property
 * @returns The count of etcd nodes
 */
export const countEtcdNodes = (nodes: Array<{ roles: string }>): number => {
  return nodes.filter(node => hasEtcdRole(node.roles)).length;
};
