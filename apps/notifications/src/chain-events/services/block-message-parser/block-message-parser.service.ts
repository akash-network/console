import {
  MsgCloseDeployment,
  MsgCreateDeployment,
} from '@akashnetwork/akash-api/v1beta3';
import type { Block } from '@cosmjs/stargate';
import { Injectable } from '@nestjs/common';

import { LoggerService } from '@src/common/services/logger.service';
import { CosmjsDecodingService } from '../cosmjs-decoding/cosmjs-decoding.service';
import { MessageDecoderService } from '../message-decoder/message-decoder.service';

export type MessageTypeFilter =
  | (typeof MsgCreateDeployment)['$type']
  | (typeof MsgCloseDeployment)['$type'];

export interface DecodedMessageValue {
  [key: string]: unknown;
}

export interface BlockMessage {
  typeUrl: string;
  type: string;
  value: DecodedMessageValue;
}

export interface BlockData {
  height: number;
  hash: string;
  time: string;
  messages: BlockMessage[];
}

interface TxMessage {
  typeUrl: string;
  value: Uint8Array;
}

interface ParsedTransaction {
  hash: string;
  height: number;
  messages: TxMessage[];
  memo: string;
}

@Injectable()
export class BlockMessageParserService {
  constructor(
    private readonly messageDecoder: MessageDecoderService,
    private readonly cosmjsDecodingService: CosmjsDecodingService,
    private readonly loggerService: LoggerService,
  ) {
    this.loggerService.setContext(BlockMessageParserService.name);
  }

  /**
   * Parses a block and extracts messages, optionally filtering by type
   * @param block The block to parse
   * @param messageTypes Optional array of message types to filter for
   * @returns The parsed block data with messages
   */
  parseBlockMessages(
    block: Block,
    messageTypes?: MessageTypeFilter[],
  ): BlockData {
    const parsedTxs = this.parseTransactionsFromBlock(block);
    const messages = this.extractMessagesFromTransactions(
      parsedTxs,
      messageTypes,
    );

    return {
      height: block.header.height,
      hash: block.id,
      time: new Date(block.header.time).toISOString(),
      messages,
    };
  }

  /**
   * Parses transactions from a block
   * @param block The block to parse transactions from
   * @returns Array of parsed transactions
   */
  private parseTransactionsFromBlock(block: Block): ParsedTransaction[] {
    if (!block.txs || block.txs.length === 0) {
      this.loggerService.debug({
        event: 'NO_TRANSACTIONS_IN_BLOCK',
        height: block.header.height,
      });
      return [];
    }

    this.loggerService.debug({
      event: 'PARSING_TRANSACTIONS_FROM_BLOCK',
      height: block.header.height,
      txCount: block.txs.length,
    });

    return Array.from(block.txs).reduce((acc, txBytes, index) => {
      try {
        const { body } = this.cosmjsDecodingService.decodeTxRaw(txBytes);

        acc.push({
          hash: this.calculateTxHash(txBytes),
          height: block.header.height,
          messages: body.messages,
          memo: body.memo,
        });

        return acc;
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        this.loggerService.error({
          event: 'ERROR_PARSING_TRANSACTION',
          height: block.header.height,
          index,
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
        });
        return acc;
      }
    }, [] as ParsedTransaction[]);
  }

  /**
   * Calculates the transaction hash from its bytes
   * @param txBytes The transaction bytes
   * @returns The transaction hash as a hex string
   */
  private calculateTxHash(txBytes: Uint8Array): string {
    return this.cosmjsDecodingService
      .toHex(this.cosmjsDecodingService.sha256(txBytes))
      .toUpperCase();
  }

  /**
   * Extracts messages from parsed transactions
   * @param transactions The parsed transactions
   * @param messageTypes Optional array of message types to filter for
   * @returns Array of block messages
   */
  private extractMessagesFromTransactions(
    transactions: ParsedTransaction[],
    messageTypes?: MessageTypeFilter[],
  ): BlockMessage[] {
    return transactions.flatMap((tx) => {
      return tx.messages.flatMap((msg) => {
        try {
          if (messageTypes && messageTypes.length > 0) {
            const matchesAny = messageTypes.some((filterType) =>
              this.messageMatchesType(msg.typeUrl, filterType),
            );

            if (!matchesAny) {
              return [];
            }
          }

          const decodedValue = this.decodeMessageValue(msg.value, msg.typeUrl);

          return [
            {
              typeUrl: msg.typeUrl,
              type: msg.typeUrl.slice(1),
              value: decodedValue,
            },
          ];
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          this.loggerService.error({
            event: 'ERROR_EXTRACTING_MESSAGE',
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined,
          });
          return [];
        }
      });
    });
  }

  /**
   * Decodes a message value based on its type
   * @param value The message value as a Uint8Array
   * @param typeUrl The message type URL
   * @returns The decoded value
   */
  private decodeMessageValue(
    value: Uint8Array,
    typeUrl: string,
  ): DecodedMessageValue {
    const decodedValue = this.messageDecoder.decodeMsg(typeUrl, value);

    if (!decodedValue) {
      throw new Error('Failed to decode message value');
    }

    return decodedValue;
  }

  /**
   * Checks if a message type matches the filter
   * @param messageTypeUrl The full message type URL to check
   * @param filter The filter to match against
   * @returns True if the message type matches the filter
   */
  private messageMatchesType(
    messageTypeUrl: string,
    filter: MessageTypeFilter,
  ): boolean {
    const normalizedUrl = messageTypeUrl.startsWith('/')
      ? messageTypeUrl.slice(1)
      : messageTypeUrl;
    const normalizedFilter = String(filter).startsWith('/')
      ? String(filter).slice(1)
      : String(filter);

    return normalizedUrl.toLowerCase() === normalizedFilter.toLowerCase();
  }
}
