import { expect, it } from "vitest";

import { PAPER_COLLAGE_STYLE_PROFILE, StyleProfileSchema } from "../src/index.js";

it("ships a versioned paper-collage style profile", () => {
  expect(StyleProfileSchema.parse(PAPER_COLLAGE_STYLE_PROFILE)).toMatchObject({
    id: "paper-collage",
    version: 1,
    motionPresetSet: "paper-v1"
  });
});
