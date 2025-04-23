import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { RegistryProvider } from '@src/chain-events/providers/registry.provider';
import { BlockCursorRepository } from '@src/chain-events/repositories/block-cursor/block-cursor.repository';
import { ChainEventsPollerService } from '@src/chain-events/services/chain-events-poller/chain-events-poller.service';
import { CosmjsDecodingService } from '@src/chain-events/services/cosmjs-decoding/cosmjs-decoding.service';
import { CommonModule } from '@src/common/common.module';
import envConfig from './config/env.config';
import { StargateClientProvider } from './providers/stargate-client/stargate-client.provider';
import { BlockMessageService } from './services/block-message/block-message.service';
import { BlockMessageParserService } from './services/block-message-parser/block-message-parser.service';
import { BlockchainClientService } from './services/blockchain-client/blockchain-client.service';
import { MessageDecoderService } from './services/message-decoder/message-decoder.service';

@Module({
  imports: [CommonModule, ConfigModule.forFeature(envConfig)],
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
  ],
  exports: [BlockMessageService, MessageDecoderService],
})
export class ChainEventsModule {}
