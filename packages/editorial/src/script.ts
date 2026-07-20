import { z } from "zod";

export const LocalizedScriptSchema = z.object({
  language: z.string().min(1),
  scenes: z.array(z.object({ id: z.string().min(1), narration: z.string().min(1) }))
});

export type LocalizedScript = z.infer<typeof LocalizedScriptSchema>;
