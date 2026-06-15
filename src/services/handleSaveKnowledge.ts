import * as FileSystem from "expo-file-system/legacy";
import { persistImageToDocuments } from "./localImageStorage";
import { insertNote } from "./database";
import type { KnowledgeMetadata } from "../types/note";

type HandleSaveKnowledgeInput = {
  text?: string;
  imageUri?: string;
};

function normalizeContent(text: string) {
  return text
    .replace(/用户输入：/g, "")
    .replace(/图片识别与分析：/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function inferLocalCategory(text: string) {
  if (/项目|需求|客户|会议|工作|计划|汇报/.test(text)) {
    return "工作";
  }

  if (/学习|论文|代码|STM32|ESP|算法|知识|课程|阅读/.test(text)) {
    return "学习";
  }

  if (/灵感|想法|创意|点子|设计/.test(text)) {
    return "灵感";
  }

  if (/生活|旅行|饮食|健康|家/.test(text)) {
    return "生活";
  }

  return "未分类";
}

function generateLocalMetadata(content: string): KnowledgeMetadata {
  const normalizedContent = normalizeContent(content);
  const firstSentence =
    normalizedContent.split(/[。！？!?；;\n]/).find(Boolean)?.trim() ??
    normalizedContent;
  const titleSource = firstSentence || "未命名知识";
  const summarySource = normalizedContent || "已保存内容，等待后续整理。";

  const candidateTags = Array.from(
    new Set(
      summarySource
        .match(/[A-Za-z0-9+#.-]{2,}|[\u4e00-\u9fa5]{2,6}/g)
        ?.map((tag) => tag.replace(/[，。！？、；：]/g, "").trim())
        .filter(Boolean) ?? [],
    ),
  ).slice(0, 6);

  return {
    title:
      titleSource.length > 28 ? `${titleSource.slice(0, 28)}...` : titleSource,
    summary:
      summarySource.length > 90
        ? `${summarySource.slice(0, 90)}...`
        : summarySource,
    category: inferLocalCategory(summarySource),
    tags: candidateTags.length ? candidateTags : ["本地保存", "待整理"],
  };
}

export async function handleSaveKnowledge(
  input: HandleSaveKnowledgeInput,
): Promise<number> {
  console.log("[handleSaveKnowledge] 开始保存知识");

  const userText = input.text?.trim() ?? "";
  let persistentImageUri: string | null = null;

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
  }

  const finalContent = [
    userText ? `用户输入：\n${userText}` : "",
    persistentImageUri && !userText ? "图片已保存到本地。" : "",
  ].filter(Boolean).join("\n\n");

  console.log("[handleSaveKnowledge] 生成本地元数据");
  const metadata = generateLocalMetadata(finalContent);

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
