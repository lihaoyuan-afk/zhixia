import React from "react";
import {
  FlatList,
  Image,
  ListRenderItem,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { NoteViewModel } from "../types/note";

type KnowledgeCardItem = NoteViewModel & {
  summary?: string;
};

type KnowledgeCardListProps = {
  notes: KnowledgeCardItem[];
  getSummary?: (note: KnowledgeCardItem) => string;
};

const CATEGORY_COLORS: Record<string, { background: string; text: string }> = {
  工作: { background: "#E8F1FF", text: "#1D4ED8" },
  学习: { background: "#E8F8EF", text: "#15803D" },
  生活: { background: "#FFF2D8", text: "#A16207" },
  灵感: { background: "#F4E8FF", text: "#7E22CE" },
  阅读: { background: "#E7F7F7", text: "#0F766E" },
  默认: { background: "#ECEFF3", text: "#475569" },
};

const CATEGORY_PALETTE = [
  { background: "#E8F1FF", text: "#1D4ED8" },
  { background: "#E8F8EF", text: "#15803D" },
  { background: "#FFF2D8", text: "#A16207" },
  { background: "#F4E8FF", text: "#7E22CE" },
  { background: "#E7F7F7", text: "#0F766E" },
  { background: "#FFE9E6", text: "#C2410C" },
];

function getCategoryColor(category?: string | null) {
  if (!category) {
    return CATEGORY_COLORS.默认;
  }

  if (CATEGORY_COLORS[category]) {
    return CATEGORY_COLORS[category];
  }

  const hash = Array.from(category).reduce(
    (total, char) => total + char.charCodeAt(0),
    0,
  );

  return CATEGORY_PALETTE[hash % CATEGORY_PALETTE.length];
}

export function KnowledgeCardList({ notes, getSummary }: KnowledgeCardListProps) {
  const renderItem: ListRenderItem<KnowledgeCardItem> = ({ item }) => {
    const categoryColor = getCategoryColor(item.category);
    const summary = item.summary ?? getSummary?.(item) ?? item.content;

    return (
      <View style={styles.card}>
        {item.image_path ? (
          <Image source={{ uri: item.image_path }} style={styles.thumbnail} />
        ) : (
          <View style={[styles.thumbnail, styles.emptyThumbnail]}>
            <Text style={styles.emptyThumbnailText}>知</Text>
          </View>
        )}

        <View style={styles.body}>
          <Text numberOfLines={2} style={styles.title}>
            {item.title}
          </Text>
          <Text numberOfLines={3} style={styles.summary}>
            {summary}
          </Text>

          <View style={styles.footer}>
            <View
              style={[
                styles.categoryBadge,
                { backgroundColor: categoryColor.background },
              ]}
            >
              <Text style={[styles.categoryText, { color: categoryColor.text }]}>
                {item.category || "未分类"}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <FlatList
      data={notes}
      keyExtractor={(item) => String(item.id)}
      renderItem={renderItem}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    padding: 16,
    gap: 12,
  },
  card: {
    minHeight: 132,
    flexDirection: "row",
    overflow: "hidden",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#DFE4EA",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  thumbnail: {
    width: 116,
    minHeight: 132,
    backgroundColor: "#F1F5F9",
  },
  emptyThumbnail: {
    alignItems: "center",
    justifyContent: "center",
  },
  emptyThumbnailText: {
    color: "#64748B",
    fontSize: 28,
    fontWeight: "700",
  },
  body: {
    flex: 1,
    padding: 14,
  },
  title: {
    color: "#111827",
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "700",
  },
  summary: {
    marginTop: 8,
    color: "#526070",
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    marginTop: "auto",
    paddingTop: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  categoryBadge: {
    minHeight: 26,
    justifyContent: "center",
    borderRadius: 6,
    paddingHorizontal: 10,
  },
  categoryText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
});
