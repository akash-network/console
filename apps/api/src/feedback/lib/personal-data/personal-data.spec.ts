import { describe, expect, it } from "vitest";

import { isPersonalDataProperty, withoutPersonalData, withoutTeammatesPrivateFields } from "./personal-data";

describe(withoutPersonalData.name, () => {
  it("drops the contact details of a hardware request even though its schema declares them", () => {
    const hardwareRequests = {
      data: [
        {
          id: "hr-1",
          userId: "u-teammate",
          gpuModel: "H200",
          details: "Need it by Monday",
          contactEmail: "jane@example.com",
          spec: { gpu: { model: "H200", count: 16 }, company: "Acme Corp", phone: "+1 555 0100", wantsToTalk: true }
        }
      ]
    };

    expect(withoutPersonalData(hardwareRequests)).toEqual({
      data: [{ id: "hr-1", gpuModel: "H200", details: "Need it by Monday", spec: { gpu: { model: "H200", count: 16 }, wantsToTalk: true } }]
    });
  });

  it("drops who created a project, with their username", () => {
    const projects = { data: [{ id: "p1", name: "Production", createdBy: { id: "u-teammate", username: "jane" }, access: { canDeploy: true } }] };

    expect(withoutPersonalData(projects)).toEqual({ data: [{ id: "p1", name: "Production", access: { canDeploy: true } }] });
  });

  it("keeps values that are not records as they are", () => {
    expect(withoutPersonalData(["web", 1, null])).toEqual(["web", 1, null]);
    expect(withoutPersonalData("jane")).toBe("jane");
  });
});

describe(isPersonalDataProperty.name, () => {
  it.each([
    "email",
    "Email",
    "emails",
    "emailAddress",
    "contactEmail",
    "invitee_email",
    "contact",
    "contactName",
    "contact-phone",
    "billingDetails",
    "billing_address",
    "webhook",
    "webhookUrl",
    "phone",
    "phoneNumber",
    "username",
    "githubUsername",
    "userId",
    "user_id",
    "createdBy",
    "updatedBy",
    "deletedBy",
    "invitedBy",
    "initiatedBy",
    "firstName",
    "lastName",
    "fullName",
    "givenName",
    "familyName",
    "inviterName",
    "legalName",
    "company",
    "companyName",
    "mobile",
    "ip",
    "IP",
    "ipAddress",
    "userAgent",
    "user-agent",
    "line1",
    "line2",
    "addressLine1",
    "addressLine2",
    "postalCode",
    "postal_code",
    "zipCode",
    "taxId",
    "card",
    "brand",
    "last4",
    "fingerprint",
    "exp_month",
    "exp_year"
  ])("treats %s as personal data", property => {
    expect(isPersonalDataProperty(property)).toBe(true);
  });

  it.each([
    "name",
    "displayName",
    "description",
    "details",
    "hostUri",
    "host",
    "website",
    "organization",
    "organizationId",
    "owner",
    "providerAddress",
    "address",
    "logoUrl",
    "githubUrl",
    "uris",
    "ips",
    "ipRegion",
    "ipCountry",
    "ipLat",
    "featEndpointIp",
    "initiator",
    "dseq",
    "state",
    "hasPaymentMethod",
    "notificationChannelId"
  ])("keeps %s, which names a deployment, provider or template rather than a person", property => {
    expect(isPersonalDataProperty(property)).toBe(false);
  });
});

describe(withoutTeammatesPrivateFields.name, () => {
  it("keeps the details of the reader's own hardware request and drops a teammate's", () => {
    const hardwareRequests = {
      data: [
        { id: "hr-own", userId: "u-reader", details: "Need it by Monday", gpuModel: "H200" },
        { id: "hr-teammate", userId: "u-teammate", details: "Budget for the unannounced launch", gpuModel: "B200" }
      ]
    };

    expect(withoutTeammatesPrivateFields("/v1/hardware-requests", hardwareRequests, "u-reader")).toEqual({
      data: [
        { id: "hr-own", userId: "u-reader", details: "Need it by Monday", gpuModel: "H200" },
        { id: "hr-teammate", userId: "u-teammate", gpuModel: "B200" }
      ]
    });
  });

  it("drops the details of a hardware request with no author", () => {
    expect(withoutTeammatesPrivateFields("/v1/hardware-requests", { data: [{ id: "hr-1", details: "Need it by Monday" }] }, "u-reader")).toEqual({
      data: [{ id: "hr-1" }]
    });
  });

  it("leaves routes without author-only fields untouched", () => {
    const activities = { data: [{ id: "a1", userId: "u-teammate", details: "Deployment closed" }] };

    expect(withoutTeammatesPrivateFields("/v1/activities", activities, "u-reader")).toEqual(activities);
  });
});
