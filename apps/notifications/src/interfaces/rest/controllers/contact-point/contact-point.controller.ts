import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post } from "@nestjs/common";
import { createZodDto } from "nestjs-zod";
import { Err, Ok, Result } from "ts-results";
import { z } from "zod";

import { NotFoundErrorResponse, ValidateHttp } from "@src/interfaces/rest/decorators/http-validate/http-validate.decorator";
import {
  contactPointConfigSchema,
  ContactPointOutput as RepoContactPointOutput,
  ContactPointRepository
} from "@src/modules/notifications/repositories/contact-point/contact-point.repository";

export const contactPointCreateInputSchema = z.object({
  name: z.string(),
  userId: z.string().uuid(),
  type: z.literal("email"),
  config: contactPointConfigSchema
});

export const contactPointOutputSchema = contactPointCreateInputSchema.extend({
  id: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const contactPointOutputResponseSchema = z.object({
  data: contactPointOutputSchema
});
export type ContactPointOutputResponse = z.infer<typeof contactPointOutputResponseSchema>;

export const contactPointPatchInputSchema = z.object({
  name: z.string().optional(),
  type: z.literal("email").optional(),
  config: contactPointConfigSchema.optional()
});

class ContactPointCreateInput extends createZodDto(z.object({ data: contactPointCreateInputSchema })) {}
class ContactPointPatchInput extends createZodDto(z.object({ data: contactPointPatchInputSchema })) {}
class ContactPointOutput extends createZodDto(contactPointOutputResponseSchema) {}

@Controller({
  version: "1",
  path: "contact-points"
})
export class ContactPointController {
  constructor(private readonly contactPointRepository: ContactPointRepository) {}

  @Post()
  @ValidateHttp({
    201: {
      schema: ContactPointOutput,
      description: "Returns the created contact point"
    }
  })
  async createContactPoint(@Body() { data }: ContactPointCreateInput): Promise<Result<ContactPointOutputResponse, unknown>> {
    return Ok({
      data: await this.contactPointRepository.create(data)
    });
  }

  @Get(":id")
  @ValidateHttp({
    200: {
      schema: ContactPointOutput,
      description: "Returns the requested contact point by id"
    },
    404: {
      schema: NotFoundErrorResponse,
      description: "Returns 404 if the contact point is not found"
    }
  })
  async getContactPoint(@Param("id") id: string): Promise<Result<ContactPointOutputResponse, NotFoundException>> {
    const contactPoint = await this.contactPointRepository.findById(id);
    return this.toResponse(contactPoint);
  }

  @Patch(":id")
  @ValidateHttp({
    200: { schema: ContactPointOutput, description: "Returns the updated contact point" },
    404: { schema: NotFoundErrorResponse, description: "Returns 404 if the contact point is not found" }
  })
  async patchContactPoint(@Param("id") id: string, @Body() { data }: ContactPointPatchInput): Promise<Result<ContactPointOutputResponse, NotFoundException>> {
    const contactPoint = await this.contactPointRepository.updateById(id, data);
    return this.toResponse(contactPoint);
  }

  @Delete(":id")
  @ValidateHttp({
    200: { schema: ContactPointOutput, description: "Returns the deleted contact point" },
    404: { schema: NotFoundErrorResponse, description: "Returns 404 if the contact point is not found" }
  })
  async deleteContactPoint(@Param("id") id: string): Promise<Result<ContactPointOutputResponse, NotFoundException>> {
    const contactPoint = await this.contactPointRepository.deleteById(id);
    return this.toResponse(contactPoint);
  }

  private toResponse(contactPoint: RepoContactPointOutput | undefined): Result<ContactPointOutputResponse, NotFoundException> {
    return contactPoint ? Ok({ data: contactPoint }) : Err(new NotFoundException("Contact point not found"));
  }
}
