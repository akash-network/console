import { sha256 } from '@cosmjs/crypto';
import { toHex } from '@cosmjs/encoding';
import { decodeTxRaw } from '@cosmjs/proto-signing';
import { Injectable } from '@nestjs/common';

@Injectable()
export class CosmjsDecodingService {
  sha256 = sha256;
  toHex = toHex;
  decodeTxRaw = decodeTxRaw;
}
