# AnimeFlow 规则仓库（Kazumi 自动同步）

把 [Predidit/KazumiRules](https://github.com/Predidit/KazumiRules) 的规则自动转换成
[AnimeFlow](https://github.com/openAnimeFlow/AnimeFlow) 的格式，让 AnimeFlow 也能吃到 Kazumi 的规则生态。

**解决的问题**：AnimeFlow 官方规则仓库只有 14 条（其中 3 条站点已死），而 Kazumi 是规则生态的源头。
本仓库每天自动同步一次，只保留**站点仍然存活**的规则。

---

## 当前内容

- 规则数：**17 条**
- 来源：KazumiRules 86 条 → 剔除已弃用 68 条、重复站点 1 条
- 其中 10 条沿用 AnimeFlow 官方中文名（安装后会**覆盖**旧规则，不会并排重复）
- 7 条是 AnimeFlow 官方仓库没有的**新增源**：`baimao` `dalvdm` `ezdmw` `sorani` `TvTFun` `xfdmneo` `xfdmnext`

## 目录结构

```
.
├── .github/workflows/sync.yml   # 每天自动同步
├── scripts/convert.js           # 转换器（Kazumi 格式 → AnimeFlow 格式）
└── plugins/
    ├── index.json               # AnimeFlow 读取的规则目录
    └── *.json                   # 每条规则
```

## 怎么用

### 1. 推到自己的 GitHub

新建一个**公开**仓库（例如 `animeflow-rules`），把本目录内容推上去：

```bash
cd animeflow-rules-repo
git init
git add .
git commit -m "init: Kazumi 规则同步仓库"
git branch -M main
git remote add origin https://github.com/<你的用户名>/animeflow-rules.git
git push -u origin main
```

> 必须是公开仓库，否则 AnimeFlow 拉不到 raw 文件。

### 2. 改 AnimeFlow 一行代码

打开 `lib/core/network/api_path.dart`，找到：

```dart
///插件仓库
pluginRepo =
    'https://raw.githubusercontent.com/openAnimeFlow/animeFlow-assets/main/plugins',
```

改成你自己的：

```dart
///插件仓库
pluginRepo =
    'https://raw.githubusercontent.com/<你的用户名>/animeflow-rules/main/plugins',
```

**只改这一处**，其它都不用动。这样和上游合并时冲突极小。

### 3. 重新编译安装

`设置 → 数据源管理` 里就能看到 17 条规则，点「更新」自动拉取。

## 转换规则说明

| Kazumi 字段 | AnimeFlow 字段 | 备注 |
|---|---|---|
| `baseURL` | `baseUrl` | |
| `searchURL` | `searchUrl` | `@keyword` → `{keyword}` |
| `searchList` / `searchName` | 同名 | |
| `searchResult` | `searchLink` | |
| `chapterRoads` | `lineList` | 线路容器 |
| `chapterResult` | `episode` | 剧集链接 |
| `searchApiConfig` / `chapterApiConfig` | 同名 | `@source` → `{source}` |
| `antiCrawlerConfig` | 同名 | |
| `api` | **重新计算** | ⚠️ 两边编号体系不同，不能照抄 |

`api` 级别说明：
- 纯 XPath 规则 → `"1"`
- 只要搜索或章节任一侧用了 API 模式 → `"2"`

> AnimeFlow 源码里明确写了「不要直接沿用其它项目的规则级别编号，数值相同不代表能力相同」，
> 所以转换器会按规则实际用到的能力重新计算，而不是搬运 Kazumi 的数字。

### 关于「混合模式」

Kazumi 里有不少规则是**搜索用 API、章节用 XPath**（当前 17 条里有 5 条）。
AnimeFlow 的 `searchMode` / `chapterMode` 是**两个独立开关**，所以转换器会分别处理：

```
searchMode: "api"   → 保留 searchApiConfig，清空 XPath 搜索字段
chapterMode: "xpath" → 保留 lineList / episode，不生成 chapterApiConfig
```

如果按「整条规则要么全 API 要么全 XPath」去转，这 5 条的章节字段会被清空，导进去看着能装、
实际搜不到剧集——这是最容易踩的坑。

## 手动跑一次

```bash
git clone --depth 1 https://github.com/Predidit/KazumiRules.git /tmp/KazumiRules
node scripts/convert.js /tmp/KazumiRules ./plugins
```

## 注意

- 转换只保证**字段对得上**，不保证**站点还活着**。Kazumi 标记弃用的已剔除，但仍可能有刚挂掉还没来得及标记的。
- 导入后建议逐条到播放页实测一集，不能用的删掉。
- 规则是数据不是代码，所以这套同步不会和 AnimeFlow 的代码产生冲突。
