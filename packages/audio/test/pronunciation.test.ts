import { expect, it } from "vitest";

import { normalizeForSpeech } from "../src/index.js";

it("replaces Japanese proper nouns with configured readings", () => {
  expect(normalizeForSpeech("徳川家康", "ja-JP", [{ surface: "徳川家康", reading: "とくがわ いえやす", language: "ja-JP" }])).toBe("とくがわ いえやす");
});
