import sharp from "sharp";

export const normalizeAssetCanvas = async (bytes: Buffer): Promise<Buffer> => sharp(bytes).trim().png().toBuffer();
