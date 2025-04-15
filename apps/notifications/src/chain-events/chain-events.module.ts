import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { RegistryProvider } from '@src/chain-events/providers/registry.provider';
import { CosmjsDecodingService } from '@src/chain-events/services/cosmjs-decoding/cosmjs-decoding.service';
import { CommonModule } from '@src/common/common.module';
import envConfig from './config/env.config';
import { StargateClientProvider } from './providers/stargate-client/stargate-client.provider';
import { BlockMessageService } from './services/block-message/block-message.service';
import { BlockMessageParserService } from './services/block-message-parser/block-message-parser.service';
import { BlockchainClientService } from './services/blockchain-client/blockchain-client.service';
import { ChainEventsService } from './services/chain-events/chain-events.service';
import { MessageDecoderService } from './services/message-decoder/message-decoder.service';

@Module({
  imports: [CommonModule, ConfigModule.forFeature(envConfig)],
  providers: [
    ChainEventsService,
    BlockMessageService,
    BlockMessageParserService,
    BlockchainClientService,
    MessageDecoderService,
    StargateClientProvider,
    CosmjsDecodingService,
    RegistryProvider,
  ],
  exports: [BlockMessageService, MessageDecoderService],
})
export class ChainEventsModule {}
