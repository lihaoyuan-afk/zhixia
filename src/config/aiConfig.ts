const MIMO_API_KEY = process.env.EXPO_PUBLIC_MIMO_API_KEY ?? "";
const MIMO_API_URL =
  process.env.EXPO_PUBLIC_MIMO_API_URL ??
  "https://token-plan-cn.xiaomimimo.com/v1/chat/completions";

export const AI_CONFIG = {
  textApiKey: MIMO_API_KEY,
  textApiUrl: MIMO_API_URL,
  textApiUrls: [MIMO_API_URL],
  textModel: process.env.EXPO_PUBLIC_MIMO_TEXT_MODEL ?? "mimo-v2-pro",
  visionApiKey: MIMO_API_KEY,
  visionApiUrl: MIMO_API_URL,
  visionApiUrls: [MIMO_API_URL],
  visionModel: process.env.EXPO_PUBLIC_MIMO_VISION_MODEL ?? "mimo-v2-omni",
  authHeaderName: "api-key" as const,
};
