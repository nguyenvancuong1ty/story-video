import type { Claim } from "./facts.js";

export type VerificationInput = {
  claims: Claim[];
  truthPolicy?: "factual" | "interpretive" | "legendary" | "fictional-alt-history";
  fictionalDisclosure?: string;
};

export type VerificationIssue = { claimId?: string; code: "MISSING_SOURCE" | "MISSING_FICTIONAL_DISCLOSURE" };
export type VerificationReport = { blockingIssues: VerificationIssue[] };

export const verifyClaims = (input: VerificationInput): VerificationReport => {
  const blockingIssues: VerificationIssue[] = input.claims
    .filter((claim) => claim.classification === "factual" && claim.sourceIds.length === 0)
    .map((claim) => ({ claimId: claim.id, code: "MISSING_SOURCE" }));

  if (input.truthPolicy === "fictional-alt-history" && !input.fictionalDisclosure?.trim()) {
    blockingIssues.push({ code: "MISSING_FICTIONAL_DISCLOSURE" });
  }

  return { blockingIssues };
};
