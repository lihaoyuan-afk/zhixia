import * as FileSystem from "expo-file-system/legacy";

const QWEN_VL_API_URL = "YOUR_QWEN_VL_API_URL";
const QWEN_VL_API_KEY = "YOUR_QWEN_VL_API_KEY";
const DEFAULT_QWEN_VL_MODEL = "qwen-vl-plus";

type AnalyzeLocalImageOptions = {
  apiKey?: string;
  apiUrl?: string;
  authHeaderName?: "Authorization" | "api-key";
  model?: string;
  mimeType?: "image/jpeg" | "image/png" | "image/webp";
};

function inferMimeType(uri: string): AnalyzeLocalImageOptions["mimeType"] {
  const lowerUri = uri.toLowerCase();

  if (lowerUri.endsWith(".png")) {
    return "image/png";
  }

  if (lowerUri.endsWith(".webp")) {
    return "image/webp";
  }

  return "image/jpeg";
}

export async function analyzeLocalImage(
  localImageUri: string,
  options: AnalyzeLocalImageOptions = {},
): Promise<string> {
  const apiUrl = options.apiUrl ?? QWEN_VL_API_URL;
  const apiKey = options.apiKey ?? QWEN_VL_API_KEY;
  const mimeType = options.mimeType ?? inferMimeType(localImageUri);

  if (apiUrl === QWEN_VL_API_URL || apiKey === QWEN_VL_API_KEY) {
    throw new Error("请先替换 Qwen-VL 的 API URL 和 API Key 占位符。");
  }

  console.log("[analyzeLocalImage] 开始读取本地图片 Base64");
  const base64Image = await FileSystem.readAsStringAsync(localImageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  console.log("[analyzeLocalImage] 开始请求 Qwen-VL 图片理解接口");
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options.authHeaderName === "api-key"
        ? { "api-key": apiKey }
        : { Authorization: `Bearer ${apiKey}` }),
    },
    body: JSON.stringify({
      model: options.model ?? DEFAULT_QWEN_VL_MODEL,
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
              text: "请分析图片中的核心知识点或文字内容。请返回一段适合保存到私人知识库的中文文字，尽量包含图片中的原文、核心结论和可复习的知识点。",
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Qwen-VL 图片分析失败：${response.status} ${errorText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (!content || typeof content !== "string") {
    throw new Error("Qwen-VL 返回内容为空或格式异常。");
  }

  console.log("[analyzeLocalImage] 图片分析完成");
  return content.trim();
}
