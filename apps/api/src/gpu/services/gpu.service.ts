import axios from "axios";
import { minutesToSeconds } from "date-fns";
import { injectable } from "tsyringe";

import { Memoize } from "@src/caching/helpers";
import { type GpuVendor, ProviderConfigGpusType } from "@src/types/gpu";
import { type GpuBreakdownQuery } from "../http-schemas/gpu.schema";
import { GpuRepository } from "../repositories/gpu.repository";

@injectable()
export class GpuService {
  constructor(private readonly gpuRepository: GpuRepository) {}

  async getGpuList({
    providerAddress,
    providerHostUri,
    vendor,
    model,
    memorySize
  }: {
    providerAddress?: string;
    providerHostUri?: string;
    vendor?: string;
    model?: string;
    memorySize?: string;
  } = {}) {
    const gpuNodes = await this.gpuRepository.getGpuList({
      providerAddress,
      providerHostUri,
      vendor,
      model,
      memorySize
    });

    const response = {
      gpus: {
        total: {
          allocatable: gpuNodes.map(x => x.allocatable).reduce((acc, x) => acc + x, 0),
          allocated: gpuNodes.map(x => x.allocated).reduce((acc, x) => acc + x, 0)
        },
        details: {} as { [key: string]: { model: string; ram: string; interface: string; allocatable: number; allocated: number }[] }
      }
    };

    for (const gpuNode of gpuNodes) {
      const vendorName = gpuNode.vendor ?? "<UNKNOWN>";
      if (!(vendorName in response.gpus.details)) {
        response.gpus.details[vendorName] = [];
      }

      const existing = response.gpus.details[vendorName].find(
        x => x.model === gpuNode.modelName && x.interface === gpuNode.interface && x.ram === gpuNode.memorySize
      );

      if (existing) {
        existing.allocatable += gpuNode.allocatable;
        existing.allocated += gpuNode.allocated;
      } else {
        response.gpus.details[vendorName].push({
          model: gpuNode.modelName,
          ram: gpuNode.memorySize,
          interface: gpuNode.interface,
          allocatable: gpuNode.allocatable,
          allocated: gpuNode.allocated
        });
      }
    }

    for (const vendorName in response.gpus.details) {
      response.gpus.details[vendorName] = response.gpus.details[vendorName].sort(
        (a, b) => a.model.localeCompare(b.model) || a.ram.localeCompare(b.ram) || a.interface.localeCompare(b.interface)
      );
    }

    return response;
  }

  @Memoize({ ttlInSeconds: minutesToSeconds(2) })
  async getGpuModels() {
    const response = await axios.get<ProviderConfigGpusType>("https://raw.githubusercontent.com/akash-network/provider-configs/main/devices/pcie/gpus.json");
    const gpuModels: GpuVendor[] = [];

    // Loop over vendors
    for (const [, vendorValue] of Object.entries(response.data)) {
      const vendor: GpuVendor = {
        name: vendorValue.name,
        models: []
      };

      // Loop over models
      for (const [, modelValue] of Object.entries(vendorValue.devices)) {
        const _modelValue = modelValue as {
          name: string;
          memory_size: string;
          interface: string;
        };
        const existingModel = vendor.models.find(x => x.name === _modelValue.name);

        if (existingModel) {
          if (!existingModel.memory.includes(_modelValue.memory_size)) {
            existingModel.memory.push(_modelValue.memory_size);
          }
          if (!existingModel.interface.includes(this.getGpuInterface(_modelValue.interface))) {
            existingModel.interface.push(this.getGpuInterface(_modelValue.interface));
          }
        } else {
          vendor.models.push({
            name: _modelValue.name,
            memory: [_modelValue.memory_size],
            interface: [this.getGpuInterface(_modelValue.interface)]
          });
        }
      }

      gpuModels.push(vendor);
    }

    return gpuModels;
  }

  private getGpuInterface(gpuInterface: string) {
    const _formatted = gpuInterface.toLowerCase();
    return _formatted.startsWith("sxm") ? "sxm" : _formatted;
  }

  @Memoize({ ttlInSeconds: minutesToSeconds(5) })
  async getGpuBreakdown(query: GpuBreakdownQuery) {
    return await this.gpuRepository.getGpuBreakdown(query);
  }
}
