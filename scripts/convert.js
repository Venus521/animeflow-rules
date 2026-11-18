#!/usr/bin/env node
/**
 * KazumiRules → AnimeFlow 规则转换器
 *
 * 用法：
 *   node scripts/convert.js <KazumiRules 目录> <输出目录>
 * 例：
 *   node scripts/convert.js ../KazumiRules ./plugins
 *
 * 转换规则：
 *   - 只保留 type === 'anime' 且未被标记 deprecated 的规则
 *   - XPath 规则 → api = "1"
 *   - API 规则   → api = "2"（AnimeFlow 的级别编号和 Kazumi 完全不同，不能照抄）
 *   - 变量占位符 @keyword / @source / @episodeUrl → {keyword} / {source} / {episodeUrl}
 *   - 字段改名：baseURL→baseUrl, searchURL→searchUrl, searchResult→searchLink,
 *              chapterRoads→lineList, chapterResult→episode
 *   - 名称映射：和 AnimeFlow 官方仓库同站的规则，改用官方中文名，这样会覆盖旧规则而不是并排重复
 */

const fs = require('fs');
const path = require('path');

/** Kazumi 规则名 → AnimeFlow 官方规则名（同名会覆盖旧规则） */
const NAME_MAP = {
  '7sefun': '七色动漫',
  'giriGiriLove': 'girigiri愛動漫',
  'AGE': 'AGE动漫',
  'mgnacg': '橘子动漫',
  'MXdm': 'MX动漫',
  'LMM': '路慢慢动漫',
  'moonci': '月之祠',
  'DM84': '动漫巴士',
  'mutefun': 'mutefun',
  'akianime': 'akianime',
};

/** 与其它规则指向同一站点、属于重复项，直接跳过 */
const SKIP = new Set([
  'aafun', // baseURL 与 moonci（月之祠）相同
]);

const PLACEHOLDER = [
  [/@keyword/g, '{keyword}'],
  [/@source/g, '{source}'],
  [/@episodeUrl/g, '{episodeUrl}'],
  [/@episodeIndex/g, '{episodeIndex}'],
  [/@episodeNumber/g, '{episodeNumber}'],
];

function fixString(value) {
  if (typeof value !== 'string') return value;
  let out = value;
  for (const [from, to] of PLACEHOLDER) out = out.replace(from, to);
  return out;
}

function deepFix(value) {
  if (typeof value === 'string') return fixString(value);
  if (Array.isArray(value)) return value.map(deepFix);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value)) out[key] = deepFix(value[key]);
    return out;
  }
  return value;
}

function isDeprecated(rule) {
  return rule.deprecated === true || rule.deprecated === 'true';
}

function convert(rule) {
  // 搜索和章节的模式是独立的：Kazumi 里有不少规则是「搜索用 API、章节用 XPath」。
  const searchApi = rule.searchMode === 'api';
  const chapterApi = rule.chapterMode === 'api';
  const baseUrl = rule.baseURL || '';

  const out = {
    api: searchApi || chapterApi ? '2' : '1',
    version: String(rule.version || '1.0.0'),
    name: NAME_MAP[rule.name] || rule.name,
    iconUrl: rule.iconUrl || (baseUrl.replace(/\/+$/, '') + '/favicon.ico'),
    baseUrl,
    // 搜索侧
    searchUrl: searchApi ? '' : fixString(rule.searchURL || ''),
    searchList: searchApi ? '' : (rule.searchList || ''),
    searchName: searchApi ? '' : (rule.searchName || ''),
    searchLink: searchApi ? '' : (rule.searchResult || ''),
    // 章节侧
    lineNames: chapterApi ? '' : (rule.lineNames || ''),
    lineList: chapterApi ? '' : (rule.chapterRoads || ''),
    episode: chapterApi ? '' : (rule.chapterResult || ''),
  };

  if (searchApi || chapterApi) {
    out.searchMode = searchApi ? 'api' : 'xpath';
    out.chapterMode = chapterApi ? 'api' : 'xpath';
  }
  if (searchApi) {
    out.searchApiConfig = deepFix(rule.searchApiConfig || {});
  }
  if (chapterApi) {
    out.chapterApiConfig = deepFix(rule.chapterApiConfig || {});
  }

  if (rule.antiCrawlerConfig) {
    out.antiCrawlerConfig = deepFix(rule.antiCrawlerConfig);
  }

  return out;
}

function slugify(name) {
  const ascii = name.replace(/[^\w.-]/g, '');
  return (ascii || 'source') + '.json';
}

function main() {
  const srcDir = process.argv[2];
  const outDir = process.argv[3];
  if (!srcDir || !outDir) {
    console.error('用法: node scripts/convert.js <KazumiRules 目录> <输出目录>');
    process.exit(1);
  }

  const files = fs
    .readdirSync(srcDir)
    .filter((f) => f.endsWith('.json') && f !== 'index.json');

  fs.mkdirSync(outDir, { recursive: true });

  const catalog = [];
  const skipped = [];
  const usedSlugs = new Set();

  for (const file of files) {
    const raw = fs.readFileSync(path.join(srcDir, file), 'utf8');
    let rule;
    try {
      rule = JSON.parse(raw);
    } catch (e) {
      skipped.push([file, 'JSON 解析失败']);
      continue;
    }

    const key = file.replace(/\.json$/, '');
    if (SKIP.has(key)) {
      skipped.push([file, '重复站点']);
      continue;
    }
    if (isDeprecated(rule)) {
      skipped.push([file, 'Kazumi 已标记弃用']);
      continue;
    }
    if (rule.type !== 'anime') {
      skipped.push([file, 'type 不是 anime']);
      continue;
    }
    if (!rule.baseURL) {
      skipped.push([file, '缺 baseURL']);
      continue;
    }

    const converted = convert(rule);

    let slug = slugify(key);
    if (usedSlugs.has(slug)) slug = slug.replace(/\.json$/, `-${usedSlugs.size}.json`);
    usedSlugs.add(slug);

    fs.writeFileSync(
      path.join(outDir, slug),
      JSON.stringify(converted, null, 2) + '\n',
    );

    catalog.push({
      name: converted.name,
      version: converted.version,
      icon: converted.iconUrl,
      path: slug,
      updateTime: String(Date.now()),
      api: converted.api,
    });
  }

  catalog.sort((a, b) => a.name.localeCompare(b.name, 'zh'));

  fs.writeFileSync(
    path.join(outDir, 'index.json'),
    JSON.stringify(catalog, null, 2) + '\n',
  );

  console.log(`✓ 已生成 ${catalog.length} 条规则 → ${outDir}`);
  for (const item of catalog) console.log(`  + ${item.name} (api ${item.api})`);
  console.log(`\n跳过 ${skipped.length} 条：`);
  const reasons = {};
  for (const [, why] of skipped) reasons[why] = (reasons[why] || 0) + 1;
  for (const [why, count] of Object.entries(reasons)) console.log(`  - ${why}: ${count}`);
}

main();
