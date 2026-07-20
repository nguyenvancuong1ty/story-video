import sharp from "sharp";

export const normalizeAssetCanvas = async (bytes: Buffer): Promise<Buffer> => sharp(bytes).png().toBuffer();

export const removeGreenScreen = async (bytes: Buffer): Promise<Buffer> => {
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let index = 0; index < data.length; index += 4) {
    const [red, green, blue] = [data[index]!, data[index + 1]!, data[index + 2]!];
    if (green > 135 && green > red * 1.25 && green > blue * 1.25) data[index + 3] = 0;
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
};
