import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { CommonModule } from "@src/common/common.module";
import { BrokerModule } from "@src/infrastructure/broker";
import { register } from "@src/infrastructure/db/db.module";
import { DbHealthzService } from "@src/infrastructure/db/services/db-healthz/db-healthz.service";
import { RegistryProvider } from "./providers/registry.provider";
import { StargateClientProvider } from "./providers/stargate-client/stargate-client.provider";
import { BlockCursorRepository } from "./repositories/block-cursor/block-cursor.repository";
import { BlockMessageService } from "./services/block-message/block-message.service";
import { BlockMessageParserService } from "./services/block-message-parser/block-message-parser.service";
import { BlockchainClientService } from "./services/blockchain-client/blockchain-client.service";
import { ChainEventsPollerService } from "./services/chain-events-poller/chain-events-poller.service";
import { CosmjsDecodingService } from "./services/cosmjs-decoding/cosmjs-decoding.service";
import { MessageDecoderService } from "./services/message-decoder/message-decoder.service";
import moduleConfig from "./config";
import * as schema from "./model-schemas";

@Module({
  imports: [CommonModule, ConfigModule.forFeature(moduleConfig), ...register(schema), BrokerModule],
  providers: [
    ChainEventsPollerService,
    BlockMessageService,
    BlockMessageParserService,
    BlockchainClientService,
    MessageDecoderService,
    StargateClientProvider,
    CosmjsDecodingService,
    RegistryProvider,
    BlockCursorRepository,
    DbHealthzService
  ],
  exports: [BlockMessageService, MessageDecoderService, DbHealthzService]
})
export class ChainModule {}
