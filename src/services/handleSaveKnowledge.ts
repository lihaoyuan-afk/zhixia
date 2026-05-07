import * as FileSystem from "expo-file-system/legacy";
import { persistImageToDocuments } from "./localImageStorage";
import { analyzeLocalImage } from "./analyzeLocalImage";
import { generateKnowledgeMetadata } from "./deepseek";
import { insertNote } from "./database";

type HandleSaveKnowledgeInput = {
  text?: string;
  imageUri?: string;
};

type HandleSaveKnowledgeOptions = {
  deepSeekApiKey: string;
  metadataApiUrl?: string;
  metadataAuthHeaderName?: "Authorization" | "api-key";
  metadataModel?: string;
  qwenApiKey?: string;
  qwenApiUrl?: string;
  qwenAuthHeaderName?: "Authorization" | "api-key";
  qwenModel?: string;
};

export async function handleSaveKnowledge(
  input: HandleSaveKnowledgeInput,
  options: HandleSaveKnowledgeOptions,
): Promise<number> {
  console.log("[handleSaveKnowledge] 开始保存知识");

  const userText = input.text?.trim() ?? "";
  let persistentImageUri: string | null = null;
  let imageText = "";

  if (!userText && !input.imageUri) {
    throw new Error("文本和图片至少需要提供一个。");
  }

  if (input.imageUri) {
    console.log("[handleSaveKnowledge] 检测到图片，开始持久化保存");
    persistentImageUri =
      FileSystem.documentDirectory &&
      input.imageUri.startsWith(FileSystem.documentDirectory)
        ? input.imageUri
        : await persistImageToDocuments(input.imageUri);
    console.log("[handleSaveKnowledge] 图片已保存到持久化目录", persistentImageUri);

    console.log("[handleSaveKnowledge] 开始分析本地图片");
    imageText = await analyzeLocalImage(persistentImageUri, {
      apiKey: options.qwenApiKey,
      apiUrl: options.qwenApiUrl,
      authHeaderName: options.qwenAuthHeaderName,
      model: options.qwenModel,
    });
    console.log("[handleSaveKnowledge] 图片文本分析完成");
  }

  const contentParts = [
    userText ? `用户输入：\n${userText}` : "",
    imageText ? `图片识别与分析：\n${imageText}` : "",
  ].filter(Boolean);

  const finalContent = contentParts.join("\n\n");

  console.log("[handleSaveKnowledge] 开始生成知识元数据");
  const metadata = await generateKnowledgeMetadata(finalContent, {
    apiKey: options.deepSeekApiKey,
    apiUrl: options.metadataApiUrl,
    authHeaderName: options.metadataAuthHeaderName,
    model: options.metadataModel,
  });
  console.log("[handleSaveKnowledge] 元数据生成完成", metadata);

  console.log("[handleSaveKnowledge] 开始写入 SQLite");
  const noteId = await insertNote({
    title: metadata.title,
    content: `AI摘要：${metadata.summary}\n\n${finalContent}`,
    image_path: persistentImageUri,
    category: metadata.category,
    tags: metadata.tags,
  });

  console.log("[handleSaveKnowledge] 保存完成，noteId =", noteId);
  return noteId;
}
