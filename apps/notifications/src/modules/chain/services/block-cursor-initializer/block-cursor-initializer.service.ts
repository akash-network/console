import { StargateClient } from "@cosmjs/stargate";
import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ExponentialBackoff, handleAll, retry } from "cockatiel";

import { LoggerService } from "@src/common/services/logger/logger.service";
import type { ChainEventsConfig } from "@src/modules/chain/config";
import { BlockCursorRepository } from "@src/modules/chain/repositories/block-cursor/block-cursor.repository";

@Injectable()
export class BlockCursorInitializerService implements OnModuleInit {
  private readonly retryExecutor = retry(handleAll, {
    maxAttempts: 5,
    backoff: new ExponentialBackoff({ initialDelay: 500, maxDelay: 5_000, exponent: 2 })
  });

  constructor(
    private readonly stargateClient: StargateClient,
    private readonly blockCursorRepository: BlockCursorRepository,
    private readonly loggerService: LoggerService,
    private readonly configService: ConfigService<ChainEventsConfig>
  ) {
    this.loggerService.setContext(BlockCursorInitializerService.name);
  }

  async onModuleInit(): Promise<void> {
    const height = await this.retryExecutor.execute(() => this.stargateClient.getHeight());

    if (this.configService.getOrThrow("chain.START_FROM_LATEST_BLOCK")) {
      await this.blockCursorRepository.setBlockHeight(height);
      this.loggerService.log({ event: "BLOCK_CURSOR_RESET_TO_LATEST", height });
      return;
    }

    await this.blockCursorRepository.ensureInitialized(height);
    this.loggerService.log({ event: "BLOCK_CURSOR_INITIALIZED", height });
  }
}
