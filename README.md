# 知匣

一个用于文字、图片和 AI 整理的私人知识库 App。

## 依赖

```bash
npx expo install expo-sqlite expo-file-system expo-image-picker
```

## 开发调试

```bash
npm install
npx expo start
```

然后用手机安装 Expo Go，并扫描终端里的二维码。手机和电脑建议连接同一个 Wi-Fi。

## 打包成手机可直接安装的 App

安卓测试安装包：

```bash
npx eas-cli login
npx eas-cli build --platform android --profile preview
```

构建完成后，下载生成的 APK，发到手机安装即可。安装后的 App 不需要电脑，也不需要 Expo Go。

安卓上架包：

```bash
npx eas-cli build --platform android --profile production
```

`preview` 会生成 APK，适合自己安装测试；`production` 会生成 AAB，适合后续上架应用商店。

## 模块

- `src/services/database.ts`：创建 `notes` 表，并提供 `insertNote`、`getAllNotes`、`searchNotes`。
- `src/services/deepseek.ts`：调用 DeepSeek API，提供 `analyzeKnowledgeText` 和 `generateKnowledgeMetadata`。
- `src/services/qwenVision.ts`：将图片转为 Base64，调用阿里云百炼 Qwen-VL 识图接口。
- `src/hooks/useLocalImage.ts`：选择图片后复制到 `FileSystem.documentDirectory`，返回持久化 `file://` URI。
- `src/services/analyzeLocalImage.ts`：读取本地图片 Base64，调用 Qwen-VL 分析图片文字和知识点。
- `src/services/handleSaveKnowledge.ts`：串联图片持久化、图片识别、DeepSeek 元数据生成和 SQLite 写入。
- `src/components/KnowledgeCardList.tsx`：使用 `FlatList` 渲染知识卡片列表。

## API Key

复制 `.env.local.example` 为 `.env.local`，填入你的密钥。当前项目已配置为优先使用小米 MiMo：

```bash
EXPO_PUBLIC_MIMO_API_KEY=your_mimo_api_key_here
EXPO_PUBLIC_MIMO_API_URL=https://api.mimo-v2.com/v1/chat/completions
EXPO_PUBLIC_MIMO_TEXT_MODEL=mimo-v2-pro
EXPO_PUBLIC_MIMO_VISION_MODEL=mimo-v2-omni
```

App 会自动读取 `.env.local`，首页只显示“已配置/未配置”。如果需要临时修改，点首页 API 配置里的“设置”。
