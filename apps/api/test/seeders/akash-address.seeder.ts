import { toBech32 } from "@cosmjs/encoding";
import { faker } from "@faker-js/faker";

export class AkashAddressSeeder {
  static create(): string {
    const addressData = new Uint8Array(20);

    for (let i = 0; i < 20; i++) {
      addressData[i] = faker.number.int({ min: 0, max: 255 });
    }

    return toBech32("akash", addressData);
  }
}
