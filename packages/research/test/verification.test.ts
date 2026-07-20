import { expect, it } from "vitest";

import { verifyClaims } from "../src/index.js";

it("blocks factual claims without sources", () => {
  expect(verifyClaims({ claims: [{ id: "c1", classification: "factual", sourceIds: [] }] }).blockingIssues).toContainEqual({
    claimId: "c1",
    code: "MISSING_SOURCE"
  });
});

it("requires disclosure for alternate history", () => {
  expect(
    verifyClaims({ claims: [], truthPolicy: "fictional-alt-history", fictionalDisclosure: undefined }).blockingIssues
  ).toContainEqual({ code: "MISSING_FICTIONAL_DISCLOSURE" });
});
