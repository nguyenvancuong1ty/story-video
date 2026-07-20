import { z } from "zod";

export const CameraPlanSchema = z.object({
  preset: z.enum(["static", "push-in", "pull-out", "pan", "orbit-simulated"]),
  direction: z.enum(["left", "right", "up", "down", "center"]),
  startScale: z.number().positive(),
  endScale: z.number().positive(),
  startX: z.number(),
  endX: z.number(),
  startY: z.number(),
  endY: z.number(),
  easing: z.enum(["linear", "ease-in-out"])
});

export const SceneLayerSchema = z
  .object({
    id: z.string().min(1),
    role: z.enum(["background", "tertiary", "secondary", "primary", "foreground", "effect", "overlay"]),
    subject: z.string().min(1),
    characterId: z.string().optional(),
    assetType: z.enum(["generated-image", "library-image", "svg", "text", "particle"]),
    assetId: z.string().optional(),
    generation: z
      .object({
        promptIntent: z.string().min(1),
        transparentBackground: z.boolean(),
        referenceAssetIds: z.array(z.string())
      })
      .optional(),
    layout: z.object({
      anchorX: z.number().min(0).max(1),
      anchorY: z.number().min(0).max(1),
      widthPercent: z.number().positive().max(100),
      scale: z.number().positive(),
      rotation: z.number(),
      zIndex: z.number().int()
    }),
    motion: z.object({
      preset: z.enum(["static", "background-parallax", "slow-drift", "primary-entrance", "paper-pop", "foreground-sweep", "subtle-breathing"]),
      startFrame: z.number().int().nonnegative(),
      endFrame: z.number().int().nonnegative().optional(),
      intensity: z.number().min(0).max(1)
    })
  })
  .superRefine((layer, context) => {
    const generated = layer.assetType === "generated-image";
    if (generated && !layer.generation) context.addIssue({ code: z.ZodIssueCode.custom, message: "generated-image requires generation" });
    if (!generated && layer.generation) context.addIssue({ code: z.ZodIssueCode.custom, message: "only generated-image may have generation" });
    if (layer.assetType === "library-image" && !layer.assetId) context.addIssue({ code: z.ZodIssueCode.custom, message: "library-image requires assetId" });
    if (layer.motion.endFrame !== undefined && layer.motion.endFrame < layer.motion.startFrame) context.addIssue({ code: z.ZodIssueCode.custom, message: "motion endFrame precedes startFrame" });
  });

export const SceneSpecSchema = z
  .object({
    id: z.string().min(1),
    narrativeBeat: z.string().min(1),
    primarySubject: z.string().min(1),
    layers: z.array(SceneLayerSchema).min(2),
    camera: CameraPlanSchema,
    subtitleSafeArea: z.object({ edge: z.literal("bottom"), insetPercent: z.literal(18) })
  })
  .superRefine((scene, context) => {
    const ids = new Set<string>();
    const zIndexes = new Set<number>();

    if (!scene.layers.some((layer) => layer.role === "primary")) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["layers"], message: "scene requires a primary layer" });
    }

    scene.layers.forEach((layer, index) => {
      if (ids.has(layer.id)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["layers", index, "id"], message: "duplicate layer id" });
      if (zIndexes.has(layer.layout.zIndex)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["layers", index, "layout", "zIndex"], message: "duplicate z-index" });
      ids.add(layer.id);
      zIndexes.add(layer.layout.zIndex);
    });
  });

export type CameraPlan = z.infer<typeof CameraPlanSchema>;
export type SceneLayer = z.infer<typeof SceneLayerSchema>;
export type SceneSpec = z.infer<typeof SceneSpecSchema>;
