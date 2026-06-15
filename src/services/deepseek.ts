import type { KnowledgeAnalysis, KnowledgeMetadata } from "../types/note";

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_METADATA_API_URL = "https://api.deepseek.com/chat/completions";

type DeepSeekOptions = {
  apiKey: string;
  apiUrl?: string;
  apiUrls?: string[];
  authHeaderName?: "Authorization" | "api-key";
  model?: string;
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

function parseJsonObject(text: string): KnowledgeAnalysis {
  const trimmed = text.trim();
  const match = trimmed.match(/\{[\s\S]*\}/);
  const jsonText = match ? match[0] : trimmed;
  const parsed = JSON.parse(jsonText) as Partial<KnowledgeAnalysis>;

  return {
    suggested_title: String(parsed.suggested_title ?? ""),
    category: String(parsed.category ?? ""),
    summary: String(parsed.summary ?? ""),
  };
}

function extractJsonText(text: string) {
  const trimmed = text.trim();
  const fencedJson = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);

  if (fencedJson?.[1]) {
    return fencedJson[1].trim();
  }

  const objectMatch = trimmed.match(/\{[\s\S]*\}/);
  return objectMatch ? objectMatch[0] : trimmed;
}

function parseKnowledgeMetadata(text: string): KnowledgeMetadata {
  try {
    const parsed = JSON.parse(extractJsonText(text)) as Partial<KnowledgeMetadata>;

    return {
      title: String(parsed.title ?? ""),
      summary: String(parsed.summary ?? ""),
      category: String(parsed.category ?? "灵感"),
      tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
    };
  } catch (error) {
    console.log("[generateKnowledgeMetadata] JSON.parse 失败", error);
    throw new Error("文本模型返回的内容不是合法 JSON，无法生成知识元数据。");
  }
}

export async function analyzeKnowledgeText(
  userText: string,
  options: DeepSeekOptions,
): Promise<KnowledgeAnalysis> {
  if (!options.apiKey) {
    throw new Error("DeepSeek API Key 不能为空。");
  }

  const response = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify({
      model: options.model ?? "deepseek-chat",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "你是一个精干的知识管家，擅长把用户随手记录的内容整理成清晰、可检索、适合沉淀到私人知识库的条目。只返回严格 JSON，不要 Markdown，不要解释。",
        },
        {
          role: "user",
          content: `请分析下面这段用户文字，并返回 JSON：{"suggested_title":"...","category":"...","summary":"..."}。\n\n用户文字：${userText}`,
        },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek 请求失败：${response.status} ${errorText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (!content || typeof content !== "string") {
    throw new Error("DeepSeek 返回内容为空或格式异常。");
  }

  return parseJsonObject(content);
}

export async function generateKnowledgeMetadata(
  rawText: string,
  options: DeepSeekOptions,
): Promise<KnowledgeMetadata> {
  if (!options.apiKey) {
    throw new Error("文本模型 API Key 不能为空。");
  }

  const apiUrls = options.apiUrls?.length
    ? options.apiUrls
    : [options.apiUrl ?? DEEPSEEK_METADATA_API_URL];
  const model = options.model ?? "deepseek-chat";

  console.log("[generateKnowledgeMetadata] 开始请求文本模型", {
    apiUrl: apiUrls[0],
    model,
  });

  const requestBody = JSON.stringify({
    model,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "你是一个只输出 JSON 的私人知识库元数据分类器。你的任务是给输入内容做元数据，不是回答、扩写、教学或续写用户内容。输出必须是一个 JSON 对象，字段只能包含：title、summary、category、tags。title 是吸引人的标题；summary 是一句话总结；category 从 工作、生活、学习、灵感 中选一个或自创一个；tags 必须是字符串数组。禁止输出 Markdown，禁止解释。",
      },
      {
        role: "user",
        content: `请为下面内容生成元数据。不要回答内容本身。只输出 JSON，格式严格为：{"title":"","summary":"","category":"","tags":[""]}\n<content>\n${rawText}\n</content>`,
      },
    ],
  });

  let response: Response | null = null;
  let usedApiUrl = "";
  let lastNetworkError: unknown = null;

  for (const apiUrl of apiUrls) {
    usedApiUrl = apiUrl;

    try {
      response = await fetchWithTimeout(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(options.authHeaderName === "api-key"
            ? { "api-key": options.apiKey }
            : { Authorization: `Bearer ${options.apiKey}` }),
        },
        body: requestBody,
      });
      break;
    } catch (error) {
      lastNetworkError = error;
      console.log("[generateKnowledgeMetadata] 文本模型网络请求失败，尝试下一个地址", {
        apiUrl,
      });
    }
  }

  if (!response) {
    throw new Error(
      `文本模型网络请求失败：${lastNetworkError instanceof Error ? lastNetworkError.message : "无法连接模型服务"}`,
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `文本模型元数据生成失败：${response.status}，接口：${usedApiUrl}，返回：${errorText}`,
    );
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (!content || typeof content !== "string") {
    throw new Error("文本模型返回内容为空或格式异常。");
  }

  const metadata = parseKnowledgeMetadata(content);
  console.log("[generateKnowledgeMetadata] 文本模型元数据解析完成");

  return metadata;
}
