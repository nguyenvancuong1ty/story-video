#!/usr/bin/env node
/**
 * Collect public YouTube search results for Second Act niche research.
 *
 * This intentionally uses anonymous YouTube.js access only. It does not log
 * into YouTube and does not use the YouTube Analytics API.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { Innertube } from 'youtubei.js';

const DEFAULT_QUERIES = [
  'gray divorce after 60',
  'starting over at 60 woman',
  'life after divorce at 60 woman',
  'retirement regrets',
  'lost job at 60',
  'living alone after 60 woman',
  'adult children boundaries',
  'reinventing at 60'
];

function usage() {
  console.log(`Usage: pnpm second-act:niche-radar [options]

Anonymous public YouTube search collector. With no query input it uses the
Second Act default preset.

Options:
  --query <text>          Add a query (repeatable). Cluster defaults to the query.
  --queries-file <path>   JSON array or text file of queries. Text may use
                          "cluster<TAB>query" per line; blank lines and # comments skip.
  --limit <number>        Results collected per query (default: 20).
  --out <path>            Output file/base path (default: out/niche-radar/youtube-niche-radar.json).
  --format <json|csv|both> Output format (default: json).
  --help                  Show this help.

JSON query-file items can be strings or objects: { "cluster": "Gray Divorce", "query": "..." }.`);
}

function parseArgs(argv) {
  const options = { queries: [], limit: 20, out: 'out/niche-radar/youtube-niche-radar.json', format: 'json' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') return { help: true };
    if (!['--query', '--queries-file', '--limit', '--out', '--format'].includes(arg)) {
      throw new Error(`Unknown option: ${arg}`);
    }
    const value = argv[++index];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
    if (arg === '--query') options.queries.push({ cluster: value, query: value });
    if (arg === '--queries-file') options.queriesFile = value;
    if (arg === '--limit') options.limit = Number(value);
    if (arg === '--out') options.out = value;
    if (arg === '--format') options.format = value.toLowerCase();
  }
  if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 100) {
    throw new Error('--limit must be an integer from 1 to 100');
  }
  if (!['json', 'csv', 'both'].includes(options.format)) {
    throw new Error('--format must be json, csv, or both');
  }
  return options;
}

function parseQueryItems(items, source) {
  if (!Array.isArray(items)) throw new Error(`${source} must contain a JSON array`);
  return items.map((item, index) => {
    if (typeof item === 'string' && item.trim()) return { cluster: item.trim(), query: item.trim() };
    if (item && typeof item === 'object' && typeof item.query === 'string' && item.query.trim()) {
      return { cluster: String(item.cluster || item.query).trim(), query: item.query.trim() };
    }
    throw new Error(`${source} item ${index + 1} must be a query string or { cluster, query }`);
  });
}

function loadQueries(file) {
  const raw = readFileSync(file, 'utf8').trim();
  if (!raw) return [];
  if (file.toLowerCase().endsWith('.json')) return parseQueryItems(JSON.parse(raw), file);
  return raw.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#')).map((line) => {
    const [cluster, query] = line.split('\t', 2);
    return query ? { cluster: cluster.trim(), query: query.trim() } : { cluster: cluster, query: cluster };
  });
}

function parseMetric(text) {
  if (!text) return null;
  const match = String(text).replace(/,/g, '').match(/([\d.]+)\s*([KMB])?/i);
  if (!match) return null;
  const multiplier = { K: 1e3, M: 1e6, B: 1e9 }[String(match[2] || '').toUpperCase()] || 1;
  return Math.round(Number(match[1]) * multiplier);
}

function ageDays(text) {
  const match = String(text || '').match(/(\d+)\s+(minute|hour|day|week|month|year)s?\s+ago/i);
  if (!match) return null;
  const units = { minute: 1 / 1440, hour: 1 / 24, day: 1, week: 7, month: 30.44, year: 365.25 };
  return Number(match[1]) * units[match[2].toLowerCase()];
}

function durationSeconds(text) {
  if (!text || !/^\d+(?::\d+){1,2}$/.test(text)) return null;
  return text.split(':').map(Number).reduce((total, part) => total * 60 + part, 0);
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function csvCell(value) {
  const text = value == null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function outputPaths(out) {
  const resolved = resolve(out);
  const extension = extname(resolved).toLowerCase();
  const base = extension === '.json' || extension === '.csv' ? resolved.slice(0, -extension.length) : resolved;
  return { json: `${base}.json`, csv: `${base}.csv` };
}

function toVideo(result, source, rank) {
  const duration = result.length_text?.text || null;
  const published = result.published?.text || null;
  const views = parseMetric(result.view_count?.text);
  const days = ageDays(published);
  return {
    title: result.title?.text || '',
    video_id: result.video_id,
    url: result.video_id ? `https://www.youtube.com/watch?v=${result.video_id}` : null,
    channel_name: result.author?.name || null,
    channel_id: result.author?.id || result.author?.channel_id || null,
    views,
    view_count_text: result.view_count?.text || null,
    duration_text: duration,
    duration_seconds: durationSeconds(duration),
    published_text: published,
    published_date: null,
    age_days: days,
    views_per_day: views != null && days ? Math.round(views / days) : null,
    thumbnail_url: result.thumbnails?.[0]?.url || null,
    sources: [{ ...source, rank }]
  };
}

function uniqueVideos(videos) {
  const byId = new Map();
  for (const video of videos) {
    if (!video.video_id) continue;
    const existing = byId.get(video.video_id);
    if (existing) existing.sources.push(...video.sources);
    else byId.set(video.video_id, video);
  }
  return [...byId.values()];
}

function buildSummary(videos, queries) {
  const views = videos.map((video) => video.views).filter(Number.isFinite);
  const globalMedian = median(views);
  const channels = new Map();
  for (const video of videos) {
    const key = video.channel_id || video.channel_name || 'Unknown channel';
    const current = channels.get(key) || { channel_name: video.channel_name, channel_id: video.channel_id, videos: 0, total_views: 0 };
    current.videos += 1;
    current.total_views += video.views || 0;
    channels.set(key, current);
  }
  const clusters = queries.map(({ cluster, query }) => {
    const matches = videos.filter((video) => video.sources.some((source) => source.cluster === cluster && source.query === query));
    return { cluster, query, unique_videos: matches.length, unique_channels: new Set(matches.map((video) => video.channel_id || video.channel_name)).size, median_views: median(matches.map((video) => video.views)) };
  });
  const outliers = videos.map((video) => ({ ...video, outlier_score: globalMedian && video.views != null ? Number((video.views / globalMedian).toFixed(2)) : null }))
    .sort((a, b) => (b.outlier_score || -1) - (a.outlier_score || -1) || (b.views || 0) - (a.views || 0)).slice(0, 10);
  return {
    total_unique_videos: videos.length,
    total_unique_channels: channels.size,
    videos_with_known_views: views.length,
    median_views: globalMedian,
    top_outlier_videos: outliers.map(({ title, video_id, url, channel_name, channel_id, views, published_text, views_per_day, outlier_score }) => ({ title, video_id, url, channel_name, channel_id, views, published_text, views_per_day, outlier_score })),
    top_channels: [...channels.values()].sort((a, b) => b.videos - a.videos || b.total_views - a.total_views).slice(0, 10),
    breakdown_by_cluster: clusters
  };
}

function printSummary(summary) {
  console.log(`\nNICHE RADAR SUMMARY\nunique_videos=${summary.total_unique_videos}\nunique_channels=${summary.total_unique_channels}\nmedian_views=${summary.median_views ?? 'n/a'}`);
  console.log('\nTOP OUTLIER VIDEOS');
  for (const video of summary.top_outlier_videos) console.log(`${video.outlier_score ?? 'n/a'}x\t${video.views ?? 'n/a'}\t${video.channel_name || 'Unknown'}\t${video.title}`);
  console.log('\nTOP CHANNELS');
  for (const channel of summary.top_channels) console.log(`${channel.videos}\t${channel.total_views}\t${channel.channel_name || 'Unknown'}`);
  console.log('\nBREAKDOWN BY CLUSTER');
  for (const cluster of summary.breakdown_by_cluster) console.log(`${cluster.cluster}\t${cluster.unique_videos} videos\t${cluster.unique_channels} channels\tmedian_views=${cluster.median_views ?? 'n/a'}`);
}

function writeCsv(path, videos) {
  const columns = ['title', 'video_id', 'url', 'channel_name', 'channel_id', 'views', 'view_count_text', 'duration_text', 'duration_seconds', 'published_text', 'published_date', 'age_days', 'views_per_day', 'thumbnail_url', 'source_clusters', 'source_queries', 'source_ranks'];
  const rows = videos.map((video) => ({
    ...video,
    source_clusters: [...new Set(video.sources.map((source) => source.cluster))].join(' | '),
    source_queries: [...new Set(video.sources.map((source) => source.query))].join(' | '),
    source_ranks: video.sources.map((source) => source.rank).join(' | ')
  }));
  writeFileSync(path, [columns.join(','), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(','))].join('\n') + '\n');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) return usage();
  const queries = [...options.queries, ...(options.queriesFile ? loadQueries(options.queriesFile) : [])];
  const activeQueries = queries.length ? queries : DEFAULT_QUERIES.map((query) => ({ cluster: query, query }));
  const yt = await Innertube.create();
  const collected = [];
  for (const source of activeQueries) {
    console.log(`Searching: ${source.cluster} -> ${source.query}`);
    const results = await yt.search(source.query);
    const videos = results.results.filter((result) => result.type === 'Video').slice(0, options.limit).map((result, index) => toVideo(result, source, index + 1));
    console.log(`  collected ${videos.length} videos`);
    collected.push(...videos);
  }
  const videos = uniqueVideos(collected);
  const summary = buildSummary(videos, activeQueries);
  const report = { schema_version: '1.0', generated_at: new Date().toISOString(), access: 'anonymous_public_youtube_search', queries: activeQueries, summary, videos };
  const paths = outputPaths(options.out);
  if (options.format === 'json' || options.format === 'both') {
    mkdirSync(dirname(paths.json), { recursive: true });
    writeFileSync(paths.json, JSON.stringify(report, null, 2) + '\n');
    console.log(`JSON: ${paths.json}`);
  }
  if (options.format === 'csv' || options.format === 'both') {
    mkdirSync(dirname(paths.csv), { recursive: true });
    writeCsv(paths.csv, videos);
    console.log(`CSV: ${paths.csv}`);
  }
  printSummary(summary);
}

main().catch((error) => {
  console.error(`Niche Radar failed: ${error.message}`);
  process.exitCode = 1;
});
