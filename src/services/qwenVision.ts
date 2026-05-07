import { File } from "expo-file-system";

const QWEN_VL_API_URL =
  "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";

type QwenVisionOptions = {
  apiKey: string;
  model?: string;
  mimeType?: "image/jpeg" | "image/png" | "image/webp";
};

export type ImageKnowledgeResult = {
  rawText: string;
  knowledgeText: string;
};

function inferMimeType(uri: string): QwenVisionOptions["mimeType"] {
  const lowerUri = uri.toLowerCase();

  if (lowerUri.endsWith(".png")) {
    return "image/png";
  }

  if (lowerUri.endsWith(".webp")) {
    return "image/webp";
  }

  return "image/jpeg";
}

export async function imageUriToBase64(imageUri: string): Promise<string> {
  const imageFile = new File(imageUri);
  return imageFile.base64();
}

export async function analyzeImageKnowledge(
  imageUri: string,
  options: QwenVisionOptions,
): Promise<ImageKnowledgeResult> {
  if (!options.apiKey) {
    throw new Error("阿里云百炼 API Key 不能为空。");
  }

  const base64Image = await imageUriToBase64(imageUri);
  const mimeType = options.mimeType ?? inferMimeType(imageUri);

  const response = await fetch(QWEN_VL_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify({
      model: options.model ?? "qwen3-vl-plus",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
              },
            },
            {
              type: "text",
              text: "请识别图片中的文字，并分析用户可能想保存的知识点是什么？请整理成适合存入私人知识库的一段文字，包含：图片文字、核心知识点、建议标题、建议分类。",
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Qwen-VL 请求失败：${response.status} ${errorText}`);
  }

  const data = await response.json();
  const rawText = data?.choices?.[0]?.message?.content;

  if (!rawText || typeof rawText !== "string") {
    throw new Error("Qwen-VL 返回内容为空或格式异常。");
  }

  return {
    rawText,
    knowledgeText: rawText.trim(),
  };
}
