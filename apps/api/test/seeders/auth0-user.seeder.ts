import { faker } from "@faker-js/faker";
import type { GetUsers200ResponseOneOfInner } from "auth0";

export class Auth0UserSeeder {
  static create({
    user_id = faker.string.uuid(),
    email = faker.internet.email(),
    email_verified = faker.datatype.boolean(),
    name = faker.person.fullName(),
    created_at = faker.date.past().toISOString(),
    updated_at = faker.date.recent().toISOString()
  }: Partial<GetUsers200ResponseOneOfInner> = {}): Partial<GetUsers200ResponseOneOfInner> {
    return {
      user_id,
      email,
      email_verified,
      name,
      created_at,
      updated_at
    };
  }
}
