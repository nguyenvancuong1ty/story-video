export type LibraryAsset = { assetId: string; cultureTags: string[]; periodTags: string[]; styleTags: string[] };

export const findCompatibleLibraryAssets = (assets: LibraryAsset[], query: Pick<LibraryAsset, "cultureTags" | "periodTags" | "styleTags">): LibraryAsset[] =>
  assets.filter((asset) => (["cultureTags", "periodTags", "styleTags"] as const).every((field) => query[field].every((tag) => asset[field].includes(tag))));
