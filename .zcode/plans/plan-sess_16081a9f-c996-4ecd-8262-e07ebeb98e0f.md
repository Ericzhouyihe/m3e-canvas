强化"AI 来画":在输入框附带截图,让接入的 GPT 复刻现有项目的界面

## 现状与结论(已探明)
- "让 AI 来画" = ShareMenu.tsx 的 ShareDialog → `startDraft(idea)`(page.tsx:2201)→ `draftDesign()`(lib/ai.ts:242)→ `complete()`(lib/ai.ts:79)→ 返回 JSON → `isProject` 校验 → `arrive` → `importDoc` 上画布(带 keep/undo)。
- 主要缺口:`complete()` 的 `system`/`user` 是纯字符串,两条请求路径的 `content` 都不支持图片。
- 现成可复用:Inspector.tsx:225 的 `readImage()`(文件→缩到 1200px→webp data URL);结果落地链路完全不用动。

## 改动(按实施顺序)

### 1. 新建 `lib/image.ts`:提取共享的图片读取
把 `readImage(file)` 和 `MAX_IMAGE_PX = 1200` 从 Inspector.tsx:180-244 移到 `lib/image.ts` 并导出,Inspector 改为 import(行为不变)。ShareMenu 复用同一实现。

### 2. `lib/ai.ts`:多模态支持(核心)
- `complete(s, system, user, signal?, maxTokens?, images: string[] = [])` 增加第 6 个可选参数(数据 URL 数组):
  - **OpenAI 兼容路径**(openai/gemini/deepseek,ai.ts:116-119):有图时 user 消息改为 `[{type:"text",text:user}, {type:"image_url",image_url:{url:<dataURL>}}...]`;system 保持字符串。
  - **Claude 路径**(ai.ts:94):有图时 user content 改为 `[{type:"image",source:{type:"base64",media_type,data}},...,{type:"text",text:user}]`;新增小工具函数解析 `data:image/...;base64,` 前缀,不匹配的图片跳过。
  - **不传图片时请求体与现在逐字节一致**(向后兼容,现有测试不动)。
- `draftDesign(s, guide, idea, lang, signal?, images = [])`:
  - 无图:提示词不变。
  - 有图:user 消息切换为复刻指令,大意:"复刻附带截图中的应用:逐屏重建图片里的界面,尽量保持布局、层级、标签与内容;作者附言:{idea};所有文案用 {lang};每个截图对应一个屏幕,保持简单"。有图时 idea 允许为空(仅附言)。

### 3. `lib/i18n.ts`:新增 ja/en/zh 文案
`askAiAttach`(添加图片)、`askAiRemoveImage`、`askAiImagesHint`(AI 会参照截图复刻设计)、`askAiNoVision`(DeepSeek 不支持看图的提示),并在 `askAiHint`(i18n.ts:120-124)里补一句"可以附带截图让 AI 复刻"。

### 4. `components/ShareMenu.tsx`:输入框支持图片
ShareDialog 新增 props:`images: string[]`、`onImages(v)`;`onDraft(idea, images)`:
- textarea 下方加一行缩略图条:每张图 64px 高圆角缩略图 + × 移除按钮;上限 4 张,超出忽略。
- 附加入口:图标按钮(add_photo_alternate)+ 隐藏 `<input type="file" accept="image/*" multiple>` → `readImage` 后追加;textarea `onPaste` 支持直接粘贴截图。
- "让 AI 生成"按钮启用条件从 `!idea.trim()` 放宽为 `idea.trim() || images.length > 0`。
- 有图且 provider 为 deepseek 时显示"当前提供商可能不支持看图"的浅色提示(页层计算传入)。
- "复制指令"(外部代理路径)保持纯文本,不变。

### 5. `app\page.tsx`:接线
- 新增页面级 state `ideaImages: string[]`(与 `ideaText` 同理:草稿失败不丢失)。
- `startDraft(idea, images)` 透传给 `draftDesign`;ShareDialog(4124-4138)传入 images/onImages,`onDraft` 改签名。
- 成功生成后不清空 idea/images(与现有 ideaText 行为一致,便于微调重试)。

### 6. `lib\ai.test.ts`:按现有 mocked-fetch 模式补测试
- OpenAI 路径带图:`messages[1].content` 为数组,含 text part + `image_url` part(url 为 data URL),system 仍为字符串。
- Claude 路径带图:content 为 `image` base64 block(校验 media_type/data)+ text block;坏 data URL 被跳过。
- 不传图:content 仍为字符串(现有断言继续覆盖)。

## 验证
1. `npm run typecheck`、`npm test`(现有 + 新增用例全过)。
2. 手动:`next dev` → 打开"让 AI 来画" → 粘贴/选择一张现有项目的 UI 截图 → 生成,确认画布出现复刻的设计、keep/undo 正常。
3. 默认行为约定:复刻结果按现有草稿流程整幅替换画布(可一键撤销),不与当前文档合并——如需"追加到现有项目"后续可以再迭代。