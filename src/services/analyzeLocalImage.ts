import * as FileSystem from "expo-file-system/legacy";

const DEFAULT_VISION_MODEL = "mimo-v2-omni";

type AnalyzeLocalImageOptions = {
  apiKey?: string;
  apiUrl?: string;
  apiUrls?: string[];
  authHeaderName?: "Authorization" | "api-key";
  model?: string;
  mimeType?: "image/jpeg" | "image/png" | "image/webp";
};

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs = 35000,
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

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
  const apiUrl = options.apiUrl;
  const apiKey = options.apiKey;
  const mimeType = options.mimeType ?? inferMimeType(localImageUri);

  if (!apiKey || !apiUrl) {
    throw new Error("视觉模型 API Key 或 API URL 不能为空。");
  }

  const apiUrls = options.apiUrls?.length ? options.apiUrls : [apiUrl];

  console.log("[analyzeLocalImage] 开始读取本地图片 Base64");
  const base64Image = await FileSystem.readAsStringAsync(localImageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  console.log("[analyzeLocalImage] 开始请求视觉模型图片理解接口");
  const requestBody = JSON.stringify({
    model: options.model ?? DEFAULT_VISION_MODEL,
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
  });

  let response: Response | null = null;
  let usedApiUrl = "";
  let lastNetworkError: unknown = null;

  for (const currentApiUrl of apiUrls) {
    usedApiUrl = currentApiUrl;

    try {
      response = await fetchWithTimeout(currentApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(options.authHeaderName === "api-key"
            ? { "api-key": apiKey }
            : { Authorization: `Bearer ${apiKey}` }),
        },
        body: requestBody,
      });
      break;
    } catch (error) {
      lastNetworkError = error;
      console.log("[analyzeLocalImage] 视觉模型网络请求失败，尝试下一个地址", {
        apiUrl: currentApiUrl,
      });
    }
  }

  if (!response) {
    throw new Error(
      `视觉模型网络请求失败：${lastNetworkError instanceof Error ? lastNetworkError.message : "无法连接模型服务"}`,
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `视觉模型图片分析失败：${response.status}，接口：${usedApiUrl}，返回：${errorText}`,
    );
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (!content || typeof content !== "string") {
    throw new Error("视觉模型返回内容为空或格式异常。");
  }

  console.log("[analyzeLocalImage] 图片分析完成");
  return content.trim();
}
