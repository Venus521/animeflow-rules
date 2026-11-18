#!/usr/bin/env node
/**
 * 把新转换出来的 Kazumi 规则并入现有 plugins 目录。
 *
 * 关键点：现有 index.json 里的官方规则（对着 AnimeFlow 调过的）是基线，
 * 只做「追加」，绝不覆盖同名源、也不覆盖同名文件。
 * 这样每日自动同步不会把官方源冲掉。
 *
 * 用法: node merge.js <新转换目录> <plugins 目录>
 */
const fs = require('fs');
const path = require('path');

function readIndex(dir) {
  const p = path.join(dir, 'index.json');
  if (!fs.existsSync(p)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error(`读取 ${p} 失败: ${err.message}`);
    return [];
  }
}

function main() {
  const kzDir = process.argv[2];
  const outDir = process.argv[3];
  if (!kzDir || !outDir) {
    console.error('用法: node merge.js <新转换目录> <plugins 目录>');
    process.exit(1);
  }

  const base = readIndex(outDir);
  const incoming = readIndex(kzDir);
  const names = new Set(base.map((e) => e.name));
  const paths = new Set(base.map((e) => e.path));
  const added = [];
  const skipped = [];

  for (const e of incoming) {
    if (!e || !e.path || !e.name) {
      skipped.push(['(未知)', '字段不全']);
      continue;
    }
    if (names.has(e.name)) {
      skipped.push([e.name, '已有同名源']);
      continue;
    }

    const src = path.join(kzDir, e.path);
    if (!fs.existsSync(src)) {
      skipped.push([e.name, '源文件缺失']);
      continue;
    }

    let target = e.path;
    if (paths.has(target) || fs.existsSync(path.join(outDir, target))) {
      target = target.replace(/\.json$/i, '-kz.json');
      if (paths.has(target) || fs.existsSync(path.join(outDir, target))) {
        skipped.push([e.name, '文件名仍然冲突']);
        continue;
      }
    }

    fs.copyFileSync(src, path.join(outDir, target));
    const item = Object.assign({}, e, { path: target });
    base.push(item);
    names.add(item.name);
    paths.add(target);
    added.push(item);
  }

  fs.writeFileSync(
    path.join(outDir, 'index.json'),
    JSON.stringify(base, null, 2) + '\n',
  );

  console.log(`✓ 合并完成：新增 ${added.length} 条，跳过 ${skipped.length} 条，当前共 ${base.length} 条`);
  for (const a of added) console.log(`  + ${a.name} (${a.path})`);
  for (const [n, why] of skipped) console.log(`  - ${n}：${why}`);
}

main();
