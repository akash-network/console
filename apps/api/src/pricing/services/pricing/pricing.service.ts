import castArray from "lodash/castArray";
import { singleton } from "tsyringe";

import { PricingBody, PricingResponse } from "@src/pricing/http-schemas/pricing.schema";
import { forEachInChunks } from "@src/utils/array/array";
import { averageHoursInAMonth } from "@src/utils/constants";
import { round } from "@src/utils/math";

@singleton()
export class PricingService {
  async getPricing(specs: PricingBody): Promise<PricingResponse> {
    const pricing: PricingResponse = [];
    await forEachInChunks(castArray(specs), ({ cpu, memory, storage }) => {
      pricing.push({
        spec: { cpu, memory, storage },
        akash: round(this.getAkashPricing(cpu, memory, storage), 2),
        aws: round(this.getAWSPricing(cpu, memory, storage), 2),
        gcp: round(this.getGCPPricing(cpu, memory, storage), 2),
        azure: round(this.getAzurePricing(cpu, memory, storage), 2)
      });
    });

    return Array.isArray(specs) ? pricing : pricing[0];
  }

  private getAkashPricing(cpu: number, memory: number, storage: number) {
    // Pricing obtained from https://github.com/akash-network/helm-charts/blob/main/charts/akash-provider/scripts/price_script_generic.sh
    const targetMemory = 1.25; // USD/GB-month
    const targetHDEphemeral = 0.08; // USD/GB-month
    // const targetHDPersHDD = 0.1; // USD/GB-month
    // const targetHDPersSSD = 0.12; // USD/GB-month
    // const targetHDPersNVME = 0.14; // USD/GB-month
    const targetCPU = 4.5; // USD/thread-month

    const price = (cpu / 1_000) * targetCPU + (memory / (1000 * 1000 * 1000)) * targetMemory + (storage / (1000 * 1000 * 1000)) * targetHDEphemeral;

    return price;
  }

  private getAWSPricing(cpu: number, memory: number, storage: number) {
    // Pricing obtained from https://aws.amazon.com/fargate/pricing/
    const cpuPrice = 0.04048; // USD/thread-hour
    const memoryPrice = 0.004445; // USD/GB-hour
    const ephemeralStorage = 0.000111; // USD/GB-hour past 20GB

    const freeStorage = 20 * 1000 * 1000 * 1000; // 20GB

    const price =
      (cpu / 1_000) * averageHoursInAMonth * cpuPrice +
      (memory / (1000 * 1000 * 1000)) * averageHoursInAMonth * memoryPrice +
      (Math.max(0, storage - freeStorage) / (1000 * 1000 * 1000)) * averageHoursInAMonth * ephemeralStorage;

    return price;
  }

  private getGCPPricing(cpu: number, memory: number, storage: number) {
    // Pricing obtained from https://cloud.google.com/kubernetes-engine/pricing
    const cpuPrice = 0.0445; // USD/thread-hour
    const memoryPrice = 0.0049225; // USD/GB-hour
    const ephemeralStorage = 0.0000548; // USD/GB-hour

    const price =
      (cpu / 1_000) * averageHoursInAMonth * cpuPrice +
      (memory / (1000 * 1000 * 1000)) * averageHoursInAMonth * memoryPrice +
      (storage / (1000 * 1000 * 1000)) * averageHoursInAMonth * ephemeralStorage;

    return price;
  }

  private getAzurePricing(cpu: number, memory: number, storage: number) {
    // Pricing obtained from https://azure.microsoft.com/en-ca/pricing/details/container-instances/
    const cpuPrice = 35.478; // USD/thread-month
    const memoryPrice = 3.8909; // USD/GB-month
    const ephemeralStorage = 0; //0.06; // USD/GB-month

    const price = (cpu / 1_000) * cpuPrice + (memory / (1000 * 1000 * 1000)) * memoryPrice + (storage / (1000 * 1000 * 1000)) * ephemeralStorage;

    return price;
  }
}
