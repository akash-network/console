export function getGpuInterface(gpuInterface: string) {
  const _formatted = gpuInterface.toLowerCase();
  return _formatted.startsWith("sxm") ? "sxm" : _formatted;
}
