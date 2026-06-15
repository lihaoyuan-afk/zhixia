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
import { AI_CONFIG } from "./src/config/aiConfig";
import { KnowledgeCardList } from "./src/components/KnowledgeCardList";
import { useLocalImage } from "./src/hooks/useLocalImage";
import { getAllNotes, searchNotes } from "./src/services/database";
import { handleSaveKnowledge } from "./src/services/handleSaveKnowledge";
import type { NoteViewModel } from "./src/types/note";

function extractSummary(content: string) {
  const match = content.match(/^AI摘要：(.+?)(?:\n|$)/);
  return match?.[1]?.trim() || content.replace(/^AI摘要：/, "").trim();
}

function extractBody(content: string) {
  return content.replace(/^AI摘要：.+?(?:\n\n|\n|$)/, "").trim();
}

export default function App() {
  const [manualText, setManualText] = useState("");
  const [notes, setNotes] = useState<NoteViewModel[]>([]);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("全部");
  const [selectedNote, setSelectedNote] = useState<NoteViewModel | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [statusText, setStatusText] = useState("准备记录新的知识。");
  const { imageUri, isPicking, pickImage } = useLocalImage();
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);

  const canSave = useMemo(
    () => Boolean(manualText.trim() || selectedImageUri),
    [manualText, selectedImageUri],
  );

  const categories = useMemo(() => {
    const counts = notes.reduce<Record<string, number>>((result, note) => {
      const category = note.category || "未分类";
      result[category] = (result[category] ?? 0) + 1;
      return result;
    }, {});

    return [
      { name: "全部", count: notes.length },
      ...Object.entries(counts).map(([name, count]) => ({ name, count })),
    ];
  }, [notes]);

  const visibleNotes = useMemo(() => {
    if (selectedCategory === "全部") {
      return notes;
    }

    return notes.filter((note) => (note.category || "未分类") === selectedCategory);
  }, [notes, selectedCategory]);

  const totalTags = useMemo(() => {
    return new Set(notes.flatMap((note) => note.tags)).size;
  }, [notes]);

  const refreshNotes = useCallback(async () => {
    setIsLoadingNotes(true);
    try {
      const latestNotes = searchKeyword.trim()
        ? await searchNotes(searchKeyword)
        : await getAllNotes();
      setNotes(latestNotes);
    } catch (error) {
      console.log("[App] 加载笔记失败", error);
      Alert.alert("加载失败", error instanceof Error ? error.message : "无法读取知识库。");
    } finally {
      setIsLoadingNotes(false);
    }
  }, [searchKeyword]);

  useEffect(() => {
    refreshNotes();
  }, [refreshNotes]);

  useEffect(() => {
    if (
      selectedCategory !== "全部" &&
      !categories.some((category) => category.name === selectedCategory)
    ) {
      setSelectedCategory("全部");
    }
  }, [categories, selectedCategory]);

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
    setIsSaving(true);
    setStatusText("正在整理知识...");

    try {
      const noteId = await handleSaveKnowledge(
        {
          text: manualText,
          imageUri: selectedImageUri ?? undefined,
        },
        {
          textApiKey: AI_CONFIG.textApiKey,
          metadataApiUrl: AI_CONFIG.textApiUrl,
          metadataApiUrls: AI_CONFIG.textApiUrls,
          metadataAuthHeaderName: AI_CONFIG.authHeaderName,
          metadataModel: AI_CONFIG.textModel,
          visionApiKey: AI_CONFIG.visionApiKey,
          visionApiUrl: AI_CONFIG.visionApiUrl,
          visionApiUrls: AI_CONFIG.visionApiUrls,
          visionAuthHeaderName: AI_CONFIG.authHeaderName,
          visionModel: AI_CONFIG.visionModel,
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
  ]);

  if (selectedNote) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.detailPageHeader}>
          <Pressable
            accessibilityLabel="返回知识列表"
            onPress={() => setSelectedNote(null)}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <Feather name="arrow-left" size={22} color="#0F172A" />
          </Pressable>
          <Text numberOfLines={1} style={styles.detailPageHeaderTitle}>
            知识详情
          </Text>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.detailPageContent}
        >
          <Text style={styles.detailPageTitle}>{selectedNote.title}</Text>

          <View style={styles.detailMetaRow}>
            <Text style={styles.detailCategory}>
              {selectedNote.category || "未分类"}
            </Text>
            <Text style={styles.detailDate}>
              {selectedNote.created_at
                ? new Date(selectedNote.created_at).toLocaleString()
                : ""}
            </Text>
          </View>

          {selectedNote.image_path ? (
            <Image source={{ uri: selectedNote.image_path }} style={styles.detailPageImage} />
          ) : null}

          <View style={styles.detailBlock}>
            <Text style={styles.detailSectionTitle}>AI 摘要</Text>
            <Text style={styles.detailSummary}>{extractSummary(selectedNote.content)}</Text>
          </View>

          {selectedNote.tags.length ? (
            <View style={styles.detailBlock}>
              <Text style={styles.detailSectionTitle}>标签</Text>
              <View style={styles.detailTags}>
                {selectedNote.tags.map((tag) => (
                  <Text key={tag} style={styles.detailTag}>
                    #{tag}
                  </Text>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.detailBlock}>
            <Text style={styles.detailSectionTitle}>完整内容</Text>
            <Text selectable style={styles.detailContent}>
              {extractBody(selectedNote.content)}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

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
            <Text style={styles.sectionTitle}>检索与归纳</Text>
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

          <View style={styles.searchPanel}>
            <View style={styles.searchBox}>
              <Feather name="search" size={18} color="#64748B" />
              <TextInput
                value={searchKeyword}
                onChangeText={setSearchKeyword}
                placeholder="搜索标题或正文"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                returnKeyType="search"
                onSubmitEditing={refreshNotes}
                style={styles.searchInput}
              />
              {searchKeyword ? (
                <Pressable
                  accessibilityLabel="清空搜索"
                  onPress={() => setSearchKeyword("")}
                  style={styles.clearButton}
                >
                  <Feather name="x" size={16} color="#64748B" />
                </Pressable>
              ) : null}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryStrip}
            >
              {categories.map((category) => {
                const isActive = category.name === selectedCategory;

                return (
                  <Pressable
                    key={category.name}
                    onPress={() => setSelectedCategory(category.name)}
                    style={[
                      styles.categoryChip,
                      isActive && styles.categoryChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        isActive && styles.categoryChipTextActive,
                      ]}
                    >
                      {category.name} {category.count}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{notes.length}</Text>
                <Text style={styles.statLabel}>当前结果</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{Math.max(categories.length - 1, 0)}</Text>
                <Text style={styles.statLabel}>分类</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{totalTags}</Text>
                <Text style={styles.statLabel}>标签</Text>
              </View>
            </View>
          </View>

          {visibleNotes.length > 0 ? (
            <View style={styles.listShell}>
              <KnowledgeCardList
                notes={visibleNotes}
                getSummary={(note) => extractSummary(note.content)}
                onPressNote={setSelectedNote}
              />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>没有匹配的知识卡片</Text>
              <Text style={styles.emptyText}>换个关键词或分类试试。</Text>
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
  searchPanel: {
    marginBottom: 12,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#DDE3EA",
    padding: 12,
  },
  searchBox: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    color: "#0F172A",
    fontSize: 14,
  },
  clearButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryStrip: {
    gap: 8,
    paddingTop: 12,
    paddingBottom: 4,
  },
  categoryChip: {
    minHeight: 34,
    justifyContent: "center",
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: "#F1F5F9",
  },
  categoryChipActive: {
    backgroundColor: "#2563EB",
  },
  categoryChipText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "800",
  },
  categoryChipTextActive: {
    color: "#FFFFFF",
  },
  statsGrid: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  statItem: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
    padding: 10,
  },
  statValue: {
    color: "#0F172A",
    fontSize: 20,
    fontWeight: "900",
  },
  statLabel: {
    marginTop: 2,
    color: "#64748B",
    fontSize: 12,
    fontWeight: "700",
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
  detailPageHeader: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#DDE3EA",
    backgroundColor: "#FFFFFF",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
  },
  detailPageHeaderTitle: {
    flex: 1,
    color: "#0F172A",
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "900",
  },
  detailPageContent: {
    padding: 18,
    paddingBottom: 42,
  },
  detailPageTitle: {
    color: "#0F172A",
    fontSize: 25,
    lineHeight: 34,
    fontWeight: "900",
  },
  detailMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  detailCategory: {
    overflow: "hidden",
    borderRadius: 6,
    backgroundColor: "#E8F1FF",
    color: "#1D4ED8",
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 13,
    fontWeight: "800",
  },
  detailDate: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "700",
  },
  detailPageImage: {
    width: "100%",
    height: 240,
    borderRadius: 8,
    marginTop: 16,
    backgroundColor: "#E2E8F0",
  },
  detailBlock: {
    marginTop: 16,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#DDE3EA",
    padding: 14,
  },
  detailSectionTitle: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "900",
  },
  detailSummary: {
    marginTop: 8,
    color: "#334155",
    fontSize: 15,
    lineHeight: 22,
  },
  detailTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  detailTag: {
    borderRadius: 6,
    backgroundColor: "#F1F5F9",
    color: "#475569",
    paddingHorizontal: 9,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: "800",
  },
  detailContent: {
    marginTop: 8,
    color: "#334155",
    fontSize: 15,
    lineHeight: 24,
  },
});
