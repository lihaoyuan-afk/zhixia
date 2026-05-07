import * as FileSystem from "expo-file-system/legacy";

const IMAGE_DIRECTORY_NAME = "knowledge-images";

function getFileExtension(uri: string, mimeType?: string | null) {
  const cleanUri = uri.split("?")[0] ?? uri;
  const uriExtension = cleanUri.match(/\.([a-zA-Z0-9]+)$/)?.[1];

  if (uriExtension) {
    return uriExtension.toLowerCase();
  }

  if (mimeType?.includes("png")) {
    return "png";
  }

  if (mimeType?.includes("webp")) {
    return "webp";
  }

  return "jpg";
}

function createUniqueImageName(uri: string, mimeType?: string | null) {
  const timestamp = Date.now();
  const randomPart = Math.random().toString(36).slice(2, 10);
  const extension = getFileExtension(uri, mimeType);

  return `knowledge_${timestamp}_${randomPart}.${extension}`;
}

export async function persistImageToDocuments(
  sourceUri: string,
  mimeType?: string | null,
): Promise<string> {
  if (!FileSystem.documentDirectory) {
    throw new Error("FileSystem.documentDirectory 不可用。");
  }

  const imageDirectory = `${FileSystem.documentDirectory}${IMAGE_DIRECTORY_NAME}/`;
  const fileName = createUniqueImageName(sourceUri, mimeType);
  const persistentUri = `${imageDirectory}${fileName}`;

  const directoryInfo = await FileSystem.getInfoAsync(imageDirectory);

  if (!directoryInfo.exists) {
    await FileSystem.makeDirectoryAsync(imageDirectory, { intermediates: true });
  }

  await FileSystem.copyAsync({
    from: sourceUri,
    to: persistentUri,
  });

  return persistentUri;
}
