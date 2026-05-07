import { useCallback, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { persistImageToDocuments } from "../services/localImageStorage";

export function useLocalImage() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isPicking, setIsPicking] = useState(false);

  const pickImage = useCallback(async () => {
    setIsPicking(true);

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        throw new Error("需要相册权限才能选择图片。");
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: false,
        quality: 1,
      });

      if (result.canceled || !result.assets?.[0]) {
        return null;
      }

      const asset = result.assets[0];
      const persistentUri = await persistImageToDocuments(
        asset.uri,
        asset.mimeType,
      );

      setImageUri(persistentUri);
      return persistentUri;
    } finally {
      setIsPicking(false);
    }
  }, []);

  return {
    imageUri,
    isPicking,
    pickImage,
    persistImageToDocuments,
  };
}

export { persistImageToDocuments };
