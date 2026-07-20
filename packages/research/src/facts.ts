import type { ResearchSource } from "./provider.js";

export type FactPackage = { sources: ResearchSource[]; claims: Claim[]; provider: string; model: string };
export type ClaimClassification = "factual" | "interpretive" | "legendary" | "speculative" | "fictional-alt-history";
export type Claim = { id: string; classification: ClaimClassification; sourceIds: string[]; text?: string };
