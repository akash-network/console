import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { CommonModule } from '@src/common/common.module';
import { RegistryProvider } from '@src/modules/chain/providers/registry.provider';
import { BlockCursorRepository } from '@src/modules/chain/repositories/block-cursor/block-cursor.repository';
import { ChainEventsPollerService } from '@src/modules/chain/services/chain-events-poller/chain-events-poller.service';
import { CosmjsDecodingService } from '@src/modules/chain/services/cosmjs-decoding/cosmjs-decoding.service';
import { StargateClientProvider } from './providers/stargate-client/stargate-client.provider';
import { BlockMessageService } from './services/block-message/block-message.service';
import { BlockMessageParserService } from './services/block-message-parser/block-message-parser.service';
import { BlockchainClientService } from './services/blockchain-client/blockchain-client.service';
import { MessageDecoderService } from './services/message-decoder/message-decoder.service';
import moduleConfig from './config';

@Module({
  imports: [CommonModule, ConfigModule.forFeature(moduleConfig)],
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
export class ChainModule {}
