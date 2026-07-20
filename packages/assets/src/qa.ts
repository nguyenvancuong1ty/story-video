import sharp from "sharp";

export type AssetQaReport = { hasAlpha: boolean; width: number; height: number; issues: string[] };

export const inspectAsset = async (bytes: Buffer): Promise<AssetQaReport> => {
  const metadata = await sharp(bytes).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  const hasAlpha = metadata.hasAlpha === true;
  const issues: string[] = [];

  if (width < 2048 || height < 2048) issues.push("INSUFFICIENT_RESOLUTION");
  if (!hasAlpha) issues.push("MISSING_ALPHA");

  return { hasAlpha, width, height, issues };
};
