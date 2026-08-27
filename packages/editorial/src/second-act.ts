import { z } from "zod";

import type { LanguageModelProvider } from "./provider.js";

export const secondActVisualToneSchema = z.enum(["cool", "neutral", "warm", "hopeful"]);
export const secondActAmbienceSchema = z.enum([
  "none",
  "room-tone",
  "rain",
  "suburban-traffic",
  "office",
  "car-interior",
  "paper"
]);

export const secondActBeatSchema = z.object({
  id: z.string().min(1),
  narration: z.string().min(80),
  subtitle: z.string().min(3).max(90),
  keyPhrase: z.string().min(3).max(72),
  visualTone: secondActVisualToneSchema,
  ambience: secondActAmbienceSchema,
  visualQueries: z.array(z.string().min(3)).min(3).max(5)
});

export const secondActStorySchema = z.object({
  title: z.string().min(12).max(110),
  description: z.string().min(40).max(700),
  audiencePromise: z.string().min(20).max(240),
  fictionDisclosure: z.string().min(10).max(220),
  beats: z.array(secondActBeatSchema).min(14).max(18)
});

export type SecondActBeat = z.infer<typeof secondActBeatSchema>;
export type SecondActStory = z.infer<typeof secondActStorySchema>;

export type GenerateSecondActStoryOptions = {
  topic: string;
  model: string;
  targetMinutes?: number;
};

const systemPrompt = `You are the senior story editor and visual planner for an English-language YouTube channel called Second Act Stories.
The audience is Americans age 55 and older. Write original, emotionally credible, culturally American first-person storytelling.

Core editorial rules:
- The protagonist is 55+ and the conflict belongs to later life: gray divorce, retirement, job loss after 55, rebuilding finances, adult-child boundaries, caregiving, loneliness, identity after work, or a second chance.
- Prefer realistic American details: mortgage, pension, 401(k), Social Security, downsizing, HOA, assisted living, retirement accounts, health insurance, adult children living in another state, community college, church/community groups, local diners, ordinary suburban or small-city life.
- Do not use Asian filial-duty framing. The emotional center is autonomy, dignity, boundaries, money, identity, and rebuilding.
- No billionaire reveals, secret royalty, cartoon villains, impossible legal tricks, or melodramatic revenge.
- Do not give legal, medical, or financial advice. If legal/financial facts appear, keep them generic and narratively plausible.
- Use natural US English that sounds spoken, not translated.
- The story must have a strong first 20 seconds, escalating tension, a concrete turning point, and a satisfying but believable resolution.
- Keep the tone mature, reflective, and emotionally restrained rather than sensational.
- This is fictionalized entertainment. Never imply that a real identifiable person is being described.

Output rules:
- Return valid JSON only.
- 14 to 18 beats.
- Each beat narration should usually be 35 to 55 spoken words so the full story lands around 3 to 5 minutes.
- Each beat gets a short subtitle of roughly 4 to 10 words.
- Each beat gets one short keyPhrase, copied or closely paraphrased from its narration, suitable for restrained on-screen typography.
- Each beat gets a visualTone: cool, neutral, warm, or hopeful.
- Each beat gets one ambience cue from: none, room-tone, rain, suburban-traffic, office, car-interior, paper.
- Each beat gets 3 to 5 concise English stock-footage search queries. Plan them as separate shots, normally in this order: establishing place, human action, detail/object, emotional or transitional image, optional second action.
- Queries must describe filmable US life, places, objects, or actions, not abstract emotions. Avoid celebrity names, brands, exact copyrighted works, and impossible camera directions.
- Do not repeat the same visual query within a beat or across adjacent beats.`;

export const generateSecondActStory = async (
  provider: LanguageModelProvider,
  options: GenerateSecondActStoryOptions
): Promise<SecondActStory> => {
  const targetMinutes = options.targetMinutes ?? 4;
  return provider.generateStructured<SecondActStory>({
    model: options.model,
    schema: secondActStorySchema,
    promptTemplateRef: { id: "second-act-us55-story", version: 2 },
    language: "en-US",
    system: systemPrompt,
    user: `Create one complete Second Act Stories episode from this topic or idea. The input may be written in Vietnamese; understand it, then write the finished story in natural American English.\n\nTopic: ${options.topic}\nTarget runtime: about ${targetMinutes} minutes.\n\nMake the title clickable but believable. Make every visual query practical for stock footage and make the shots within each beat visually varied. The beats must form one continuous story, not a list of advice.`
  });
};
