import { averageHoursInAMonth } from "./constants";


export function getAkashPricing(cpu: number, memory: number, storage: number) {
  // Pricing obtained from https://github.com/akash-network/helm-charts/blob/main/charts/akash-provider/scripts/price_script_generic.sh
  const targetMemory = 1.25; // USD/GB-month
  const targetHDEphemeral = 0.08; // USD/GB-month
  const targetHDPersHDD = 0.1; // USD/GB-month
  const targetHDPersSSD = 0.12; // USD/GB-month
  const targetHDPersNVME = 0.14; // USD/GB-month
  const targetCPU = 4.5; // USD/thread-month

  const price = (cpu / 1_000) * targetCPU + (memory / (1000 * 1000 * 1000)) * targetMemory + (storage / (1000 * 1000 * 1000)) * targetHDEphemeral;

  return price;
}

export function getAWSPricing(cpu: number, memory: number, storage: number) {
  // Pricing obtained from https://aws.amazon.com/fargate/pricing/
  const cpuPrice = 0.04048; // USD/thread-hour
  const memoryPrice = 0.004445; // USD/GB-hour
  const ephemeralStrorage = 0.000111; // USD/GB-hour past 20GB

  const freeStorage = 20 * 1000 * 1000 * 1000; // 20GB

  const price =
    (cpu / 1_000) * averageHoursInAMonth * cpuPrice +
    (memory / (1000 * 1000 * 1000)) * averageHoursInAMonth * memoryPrice +
    (Math.max(0, storage - freeStorage) / (1000 * 1000 * 1000)) * averageHoursInAMonth * ephemeralStrorage;

  return price;
}

export function getGCPPricing(cpu: number, memory: number, storage: number) {
  // Pricing obtained from https://cloud.google.com/kubernetes-engine/pricing
  const cpuPrice = 0.0445; // USD/thread-hour
  const memoryPrice = 0.0049225; // USD/GB-hour
  const ephemeralStrorage = 0.0000548; // USD/GB-hour

  const price =
    (cpu / 1_000) * averageHoursInAMonth * cpuPrice +
    (memory / (1000 * 1000 * 1000)) * averageHoursInAMonth * memoryPrice +
    (storage / (1000 * 1000 * 1000)) * averageHoursInAMonth * ephemeralStrorage;

  return price;
}

export function getAzurePricing(cpu: number, memory: number, storage: number) {
  // Pricing obtained from https://azure.microsoft.com/en-ca/pricing/details/container-instances/
  const cpuPrice = 35.478; // USD/thread-month
  const memoryPrice = 3.8909; // USD/GB-month
  const ephemeralStrorage = 0; //0.06; // USD/GB-month

  const price = (cpu / 1_000) * cpuPrice + (memory / (1000 * 1000 * 1000)) * memoryPrice + (storage / (1000 * 1000 * 1000)) * ephemeralStrorage;

  return price;
}
