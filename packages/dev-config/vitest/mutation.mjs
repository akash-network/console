/** Mutation testing reruns the suite per mutant, so only unit projects take part: the rest need services and are orders of magnitude slower. */
export function unitProjectsOnly(config) {
  const unitProjects = (config.test?.projects ?? []).filter(project => project?.test?.name?.startsWith("unit"));

  return unitProjects.length > 0 ? { ...config, test: { ...config.test, projects: unitProjects } } : config;
}
