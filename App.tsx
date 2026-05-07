import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import Feather from "@expo/vector-icons/Feather";
import { KnowledgeCardList } from "./src/components/KnowledgeCardList";
import { useLocalImage } from "./src/hooks/useLocalImage";
import { getAllNotes } from "./src/services/database";
import { handleSaveKnowledge } from "./src/services/handleSaveKnowledge";
import type { NoteViewModel } from "./src/types/note";

const DEFAULT_QWEN_API_URL =
  "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const DEFAULT_MIMO_API_URL = "https://api.mimo-v2.com/v1/chat/completions";
const DEFAULT_TEXT_MODEL = "mimo-v2-pro";
const DEFAULT_VISION_MODEL = "mimo-v2-omni";
const ENV_TEXT_API_KEY =
  process.env.EXPO_PUBLIC_TEXT_API_KEY ??
  process.env.EXPO_PUBLIC_MIMO_API_KEY ??
  process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY ??
  "";
const ENV_TEXT_API_URL =
  process.env.EXPO_PUBLIC_TEXT_API_URL ??
  process.env.EXPO_PUBLIC_MIMO_API_URL ??
  DEFAULT_MIMO_API_URL;
const ENV_TEXT_MODEL =
  process.env.EXPO_PUBLIC_TEXT_MODEL ??
  process.env.EXPO_PUBLIC_MIMO_TEXT_MODEL ??
  DEFAULT_TEXT_MODEL;
const ENV_VISION_API_KEY =
  process.env.EXPO_PUBLIC_VISION_API_KEY ??
  process.env.EXPO_PUBLIC_MIMO_API_KEY ??
  process.env.EXPO_PUBLIC_QWEN_API_KEY ??
  "";
const ENV_VISION_API_URL =
  process.env.EXPO_PUBLIC_VISION_API_URL ??
  process.env.EXPO_PUBLIC_MIMO_API_URL ??
  process.env.EXPO_PUBLIC_QWEN_API_URL ??
  DEFAULT_MIMO_API_URL;
const ENV_VISION_MODEL =
  process.env.EXPO_PUBLIC_VISION_MODEL ??
  process.env.EXPO_PUBLIC_MIMO_VISION_MODEL ??
  DEFAULT_VISION_MODEL;

function extractSummary(content: string) {
  const match = content.match(/^AI摘要：(.+?)(?:\n|$)/);
  return match?.[1]?.trim() || content.replace(/^AI摘要：/, "").trim();
}

export default function App() {
  const [manualText, setManualText] = useState("");
  const [textApiKey, setTextApiKey] = useState(ENV_TEXT_API_KEY);
  const [textApiUrl, setTextApiUrl] = useState(ENV_TEXT_API_URL);
  const [textModel, setTextModel] = useState(ENV_TEXT_MODEL);
  const [visionApiKey, setVisionApiKey] = useState(ENV_VISION_API_KEY);
  const [visionApiUrl, setVisionApiUrl] = useState(ENV_VISION_API_URL);
  const [visionModel, setVisionModel] = useState(ENV_VISION_MODEL);
  const [showApiSettings, setShowApiSettings] = useState(
    !ENV_TEXT_API_KEY || !ENV_VISION_API_KEY,
  );
  const [notes, setNotes] = useState<NoteViewModel[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [statusText, setStatusText] = useState("准备记录新的知识。");
  const { imageUri, isPicking, pickImage } = useLocalImage();
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);

  const canSave = useMemo(
    () => Boolean(manualText.trim() || selectedImageUri) && Boolean(textApiKey.trim()),
    [manualText, selectedImageUri, textApiKey],
  );

  const refreshNotes = useCallback(async () => {
    setIsLoadingNotes(true);
    try {
      const latestNotes = await getAllNotes();
      setNotes(latestNotes);
    } catch (error) {
      console.log("[App] 加载笔记失败", error);
      Alert.alert("加载失败", error instanceof Error ? error.message : "无法读取知识库。");
    } finally {
      setIsLoadingNotes(false);
    }
  }, []);

  useEffect(() => {
    refreshNotes();
  }, [refreshNotes]);

  useEffect(() => {
    if (ENV_TEXT_API_KEY) {
      setTextApiKey(ENV_TEXT_API_KEY);
      setTextApiUrl(ENV_TEXT_API_URL);
      setTextModel(ENV_TEXT_MODEL);
    }

    if (ENV_VISION_API_KEY) {
      setVisionApiKey(ENV_VISION_API_KEY);
      setVisionApiUrl(ENV_VISION_API_URL);
      setVisionModel(ENV_VISION_MODEL);
    }
  }, []);

  useEffect(() => {
    if (imageUri) {
      setSelectedImageUri(imageUri);
      setStatusText("图片已保存到本地持久化目录。");
    }
  }, [imageUri]);

  const handlePickImage = useCallback(async () => {
    try {
      setStatusText("正在选择并保存图片...");
      const uri = await pickImage();

      if (uri) {
        setSelectedImageUri(uri);
      } else {
        setStatusText("已取消选择图片。");
      }
    } catch (error) {
      console.log("[App] 选择图片失败", error);
      Alert.alert("选择图片失败", error instanceof Error ? error.message : "请稍后再试。");
      setStatusText("选择图片失败。");
    }
  }, [pickImage]);

  const handleSave = useCallback(async () => {
    if (!textApiKey.trim()) {
      Alert.alert("缺少文本模型 Key", "请先配置文本模型 API Key。");
      return;
    }

    if (selectedImageUri && !visionApiKey.trim()) {
      Alert.alert("缺少视觉模型 Key", "保存图片知识需要配置视觉模型 API Key。");
      return;
    }

    setIsSaving(true);
    setStatusText("正在整理知识...");

    try {
      const noteId = await handleSaveKnowledge(
        {
          text: manualText,
          imageUri: selectedImageUri ?? undefined,
        },
        {
          deepSeekApiKey: textApiKey.trim(),
          metadataApiUrl: textApiUrl.trim() || DEFAULT_MIMO_API_URL,
          metadataAuthHeaderName: "api-key",
          metadataModel: textModel.trim() || DEFAULT_TEXT_MODEL,
          qwenApiKey: visionApiKey.trim() || undefined,
          qwenApiUrl: visionApiUrl.trim() || DEFAULT_QWEN_API_URL,
          qwenAuthHeaderName: "api-key",
          qwenModel: visionModel.trim() || DEFAULT_VISION_MODEL,
        },
      );

      console.log("[App] 保存成功", noteId);
      setManualText("");
      setSelectedImageUri(null);
      setStatusText(`保存成功，编号 ${noteId}`);
      await refreshNotes();
    } catch (error) {
      console.log("[App] 保存失败", error);
      Alert.alert("保存失败", error instanceof Error ? error.message : "请检查网络和 API Key。");
      setStatusText("保存失败，请检查配置后重试。");
    } finally {
      setIsSaving(false);
    }
  }, [
    manualText,
    refreshNotes,
    selectedImageUri,
    textApiKey,
    textApiUrl,
    textModel,
    visionApiKey,
    visionApiUrl,
    visionModel,
  ]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.header}>
            <Text style={styles.appTitle}>知匣</Text>
            <Text style={styles.appSubtitle}>文字、图片、AI 整理，一次存好。</Text>
          </View>

          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <Feather name="key" size={18} color="#2563EB" />
              <Text style={styles.panelTitle}>API 配置</Text>
              <Pressable
                onPress={() => setShowApiSettings((value) => !value)}
                style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}
              >
                <Text style={styles.smallButtonText}>
                  {showApiSettings ? "收起" : "设置"}
                </Text>
              </Pressable>
            </View>

            <Text style={styles.configStatus}>
              文本模型：{textApiKey ? "已配置" : "未配置"} · 视觉模型：
              {visionApiKey ? "已配置" : "未配置"}
            </Text>

            {showApiSettings ? (
              <>
                <TextInput
                  value={textApiKey}
                  onChangeText={setTextApiKey}
                  placeholder="文本模型 API Key，必填"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry
                  autoCapitalize="none"
                  style={styles.input}
                />
                <TextInput
                  value={textApiUrl}
                  onChangeText={setTextApiUrl}
                  placeholder="文本模型 API URL"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  style={styles.input}
                />
                <TextInput
                  value={textModel}
                  onChangeText={setTextModel}
                  placeholder="文本模型名称"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  style={styles.input}
                />
                <TextInput
                  value={visionApiKey}
                  onChangeText={setVisionApiKey}
                  placeholder="视觉模型 API Key，图片分析时必填"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry
                  autoCapitalize="none"
                  style={styles.input}
                />
                <TextInput
                  value={visionApiUrl}
                  onChangeText={setVisionApiUrl}
                  placeholder="视觉模型 API URL"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  style={styles.input}
                />
                <TextInput
                  value={visionModel}
                  onChangeText={setVisionModel}
                  placeholder="视觉模型名称"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  style={styles.input}
                />
              </>
            ) : null}
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>新增知识</Text>
            <TextInput
              value={manualText}
              onChangeText={setManualText}
              placeholder="写下你想保存的想法、摘录、灵感或待办..."
              placeholderTextColor="#94A3B8"
              multiline
              textAlignVertical="top"
              style={[styles.input, styles.textArea]}
            />

            {selectedImageUri ? (
              <View style={styles.previewWrap}>
                <Image source={{ uri: selectedImageUri }} style={styles.previewImage} />
                <Pressable
                  accessibilityLabel="移除图片"
                  onPress={() => setSelectedImageUri(null)}
                  style={styles.removeImageButton}
                >
                  <Feather name="x" size={18} color="#FFFFFF" />
                </Pressable>
              </View>
            ) : null}

            <View style={styles.actions}>
              <Pressable
                disabled={isPicking || isSaving}
                onPress={handlePickImage}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.pressed,
                  (isPicking || isSaving) && styles.disabledButton,
                ]}
              >
                <Feather name="image" size={18} color="#0F766E" />
                <Text style={styles.secondaryButtonText}>
                  {isPicking ? "选择中" : "选择图片"}
                </Text>
              </Pressable>

              <Pressable
                disabled={!canSave || isSaving}
                onPress={handleSave}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.pressed,
                  (!canSave || isSaving) && styles.disabledButton,
                ]}
              >
                {isSaving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Feather name="save" size={18} color="#FFFFFF" />
                )}
                <Text style={styles.primaryButtonText}>
                  {isSaving ? "保存中" : "保存知识"}
                </Text>
              </Pressable>
            </View>

            <Text style={styles.statusText}>{statusText}</Text>
          </View>

          <View style={styles.listHeader}>
            <Text style={styles.sectionTitle}>知识列表</Text>
            <Pressable
              accessibilityLabel="刷新列表"
              onPress={refreshNotes}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            >
              {isLoadingNotes ? (
                <ActivityIndicator size="small" color="#334155" />
              ) : (
                <Feather name="refresh-cw" size={18} color="#334155" />
              )}
            </Pressable>
          </View>

          {notes.length > 0 ? (
            <View style={styles.listShell}>
              <KnowledgeCardList notes={notes} getSummary={(note) => extractSummary(note.content)} />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>还没有知识卡片</Text>
              <Text style={styles.emptyText}>保存第一条内容后，它会出现在这里。</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F6F7F9",
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 40,
  },
  header: {
    paddingTop: 8,
    paddingBottom: 18,
  },
  appTitle: {
    color: "#0F172A",
    fontSize: 30,
    fontWeight: "800",
  },
  appSubtitle: {
    marginTop: 6,
    color: "#64748B",
    fontSize: 15,
    lineHeight: 22,
  },
  panel: {
    marginBottom: 14,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#DDE3EA",
    padding: 14,
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  panelTitle: {
    flex: 1,
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "800",
  },
  smallButton: {
    minHeight: 32,
    borderRadius: 8,
    justifyContent: "center",
    paddingHorizontal: 12,
    backgroundColor: "#EEF2FF",
  },
  smallButtonText: {
    color: "#2563EB",
    fontSize: 13,
    fontWeight: "800",
  },
  configStatus: {
    color: "#64748B",
    fontSize: 13,
    lineHeight: 18,
  },
  input: {
    minHeight: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    color: "#0F172A",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
    fontSize: 14,
  },
  textArea: {
    minHeight: 132,
    lineHeight: 21,
  },
  previewWrap: {
    marginTop: 12,
    overflow: "hidden",
    borderRadius: 8,
    backgroundColor: "#E2E8F0",
  },
  previewImage: {
    width: "100%",
    height: 190,
  },
  removeImageButton: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.72)",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#2563EB",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#99F6E4",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#F0FDFA",
  },
  secondaryButtonText: {
    color: "#0F766E",
    fontSize: 15,
    fontWeight: "800",
  },
  disabledButton: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.82,
  },
  statusText: {
    marginTop: 12,
    color: "#64748B",
    fontSize: 13,
    lineHeight: 18,
  },
  listHeader: {
    marginTop: 4,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800",
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#DDE3EA",
  },
  listShell: {
    minHeight: 220,
    marginHorizontal: -16,
  },
  emptyState: {
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#DDE3EA",
    padding: 22,
  },
  emptyTitle: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "800",
  },
  emptyText: {
    marginTop: 6,
    color: "#64748B",
    fontSize: 14,
    lineHeight: 20,
  },
});
