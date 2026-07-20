export type SceneTiming = { sceneId: string; durationMs: number };

export const updateSceneTimings = <T extends { scenes: Array<{ id: string }> }>(storyboard: T, timings: SceneTiming[], fps = 30): T & { scenes: Array<T["scenes"][number] & { durationMs: number; durationFrames: number }> } => {
  const byScene = new Map(timings.map((timing) => [timing.sceneId, timing]));

  return {
    ...storyboard,
    scenes: storyboard.scenes.map((scene) => {
      const timing = byScene.get(scene.id);
      if (!timing) return scene as T["scenes"][number] & { durationMs: number; durationFrames: number };

      return { ...scene, durationMs: timing.durationMs, durationFrames: Math.round((timing.durationMs / 1000) * fps) };
    })
  };
};
