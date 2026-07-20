import { expect, it } from "vitest";
import { z } from "zod";

import { FakeLanguageModelProvider } from "../src/index.js";

it("returns schema-validated structured output from a provider fake", async () => {
  const provider = new FakeLanguageModelProvider({ language: "ja-JP", scenes: [] });
  const schema = z.object({ language: z.literal("ja-JP"), scenes: z.array(z.unknown()) });

  await expect(
    provider.generateStructured({
      model: "editorial-model",
      schema,
      promptTemplateRef: { id: "localized-script", version: 1 },
      language: "ja-JP",
      system: "system",
      user: "user"
    })
  ).resolves.toEqual({ language: "ja-JP", scenes: [] });
});
