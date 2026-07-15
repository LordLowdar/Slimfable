/**
 * fetch-stats.mjs — refresh Slim's live channel stats + latest videos.
 *
 * Pulls, with no API keys:
 *   - YouTube subscribers / total views / video count / joined date
 *     (scraped from the public channel pages)
 *   - Latest uploads (official RSS feed) and the newest long-form video
 *   - Instagram follower count (public web profile endpoint)
 *
 * Writes assets/stats.json, which main.js reads at page load. On any partial
 * failure the previous values for that section are kept, so the site never
 * regresses — worst case a number lags until the next successful run.
 *
 * Run:  node scripts/fetch-stats.mjs   (also runs daily via GitHub Actions)
 * Dependency-free: uses Node's built-in https module (works on Node 14+).
 */

import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_JSON = path.join(ROOT, 'assets', 'stats.json');

const YT_HANDLE = 'slim.s1k';
const YT_CHANNEL_ID = 'UCLT7V2MkIbR9ZtSgdqw5h8A';
const IG_USERNAME = 'slim.s1k';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/* ---------- promisified https GET (follows redirects) ---------- */
function get(url, headers = {}, redirects = 0) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: Object.assign({ 'user-agent': UA, 'accept-language': 'en-US,en' }, headers) }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects < 5) {
          res.resume();
          const next = new URL(res.headers.location, url).href;
          return get(next, headers, redirects + 1).then(resolve, reject);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve(body));
      })
      .on('error', reject);
  });
}

/** Resolve the status code of a URL without downloading the body. */
function status(url) {
  return new Promise((resolve) => {
    https
      .get(url, { headers: { 'user-agent': UA } }, (res) => {
        res.destroy();
        resolve(res.statusCode);
      })
      .on('error', () => resolve(0));
  });
}

/* ---------- parse helpers ---------- */
/** "3.26K" / "13,788,729" / "1.2M" → number */
function parseCount(str) {
  const m = String(str).trim().match(/^([\d.,]+)\s*([KM])?$/i);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ''));
  const mult = { K: 1e3, M: 1e6 }[(m[2] || '').toUpperCase()] || 1;
  return Math.round(n * mult);
}

function walk(obj, visit) {
  if (Array.isArray(obj)) return obj.forEach((v) => walk(v, visit));
  if (obj && typeof obj === 'object') {
    visit(obj);
    Object.values(obj).forEach((v) => walk(v, visit));
  }
}

/* ---------- YouTube: channel-level stats ---------- */
async function fetchYouTubeStats() {
  const html = await get(`https://www.youtube.com/@${YT_HANDLE}/about`);
  // Anchor on the channel-level about-panel keys — the page also contains
  // per-video "X views" strings that must not win.
  const subs = html.match(/"subscriberCountText"[^{}]*?"([\d.,]+[KM]?) subscribers"/) ||
               html.match(/"([\d.,]+[KM]?) subscribers"/);
  const views = html.match(/"viewCountText"[^{}]*?"([\d,]+) views"/);
  const videos = html.match(/"videoCountText"[^{}]*?"([\d,]+) videos?"/);
  const joined = html.match(/"Joined (\w+ \d{1,2}, \d{4})"/);
  const out = {
    ytSubscribers: subs ? parseCount(subs[1]) : null,
    ytViews: views ? parseCount(views[1]) : null,
    ytVideos: videos ? parseCount(videos[1]) : null,
    ytJoined: joined ? new Date(joined[1] + ' UTC').toISOString().slice(0, 10) : null,
  };
  if (Object.values(out).every((v) => v === null)) throw new Error('no stats found in about page');
  return out;
}

/* ---------- YouTube: newest long-form video (Videos tab) ---------- */
async function fetchYouTubeLongform() {
  const html = await get(`https://www.youtube.com/@${YT_HANDLE}/videos`);
  const m = html.match(/var ytInitialData = ({[\s\S]*?});<\/script>/);
  if (!m) throw new Error('ytInitialData not found in videos tab');
  const found = [];
  walk(JSON.parse(m[1]), (o) => {
    if (!o.lockupViewModel || !o.lockupViewModel.contentId) return;
    const lv = o.lockupViewModel;
    if (found.some((f) => f.id === lv.contentId)) return;
    const meta = lv.metadata && lv.metadata.lockupMetadataViewModel;
    const s = JSON.stringify(lv);
    const dur = s.match(/"text":"(\d+:\d{2}(?::\d{2})?)"/);
    const views = s.match(/"content":"([\d.,]+[KM]?) views"/);
    found.push({
      id: lv.contentId,
      title: meta && meta.title ? meta.title.content : '',
      duration: dur ? dur[1] : null,
      views: views ? parseCount(views[1]) : null,
    });
  });
  if (found.length === 0) throw new Error('no long-form videos found');
  return found;
}

/* ---------- YouTube: latest uploads (official RSS, newest first) ---------- */
async function fetchYouTubeFeed() {
  const xml = await get(`https://www.youtube.com/feeds/videos.xml?channel_id=${YT_CHANNEL_ID}`);
  const entries = [];
  const blocks = xml.split('<entry>').slice(1);
  for (const block of blocks) {
    const id = block.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
    const title = block.match(/<title>([^<]*)<\/title>/);
    const published = block.match(/<published>([^<]+)<\/published>/);
    const views = block.match(/views="(\d+)"/);
    if (!id) continue;
    entries.push({
      id: id[1],
      title: title ? title[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'") : '',
      published: published ? published[1] : null,
      views: views ? Number(views[1]) : null,
    });
  }
  if (entries.length === 0) throw new Error('empty RSS feed');
  return entries;
}

/** Best available thumbnail; Shorts get their vertical art when it exists. */
async function pickThumb(id, isShort) {
  const candidates = isShort
    ? [`https://i.ytimg.com/vi/${id}/oar2.jpg`, `https://i.ytimg.com/vi/${id}/hqdefault.jpg`]
    : [`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`, `https://i.ytimg.com/vi/${id}/hqdefault.jpg`];
  for (const url of candidates) {
    if ((await status(url)) === 200) return url;
  }
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

/* ---------- Instagram follower count ---------- */
async function fetchInstagram() {
  const body = await get(
    `https://i.instagram.com/api/v1/users/web_profile_info/?username=${IG_USERNAME}`,
    { 'x-ig-app-id': '936619743392459' }
  );
  const json = JSON.parse(body);
  const count = json && json.data && json.data.user && json.data.user.edge_followed_by
    ? json.data.user.edge_followed_by.count
    : null;
  if (!count) throw new Error('follower count missing from response');
  return { igFollowers: count };
}

/* ---------- main ---------- */
async function main() {
  let previous = {};
  try {
    previous = JSON.parse(fs.readFileSync(OUT_JSON, 'utf8'));
  } catch (e) {
    /* first run — nothing to merge */
  }

  const result = {
    updated: new Date().toISOString(),
    stats: Object.assign({}, previous.stats),
    featured: previous.featured || null,
    shorts: previous.shorts || [],
  };
  let ok = 0;

  console.log('→ YouTube channel stats…');
  try {
    Object.assign(result.stats, await fetchYouTubeStats());
    ok++;
    console.log(`  ✔ ${result.stats.ytSubscribers} subs · ${result.stats.ytViews} views · ${result.stats.ytVideos} videos`);
  } catch (e) {
    console.warn(`  ⚠ kept previous values (${e.message})`);
  }

  console.log('→ Instagram followers…');
  try {
    Object.assign(result.stats, await fetchInstagram());
    ok++;
    console.log(`  ✔ ${result.stats.igFollowers} followers`);
  } catch (e) {
    console.warn(`  ⚠ kept previous value (${e.message})`);
  }

  console.log('→ Latest videos…');
  try {
    const [longform, feed] = await Promise.all([fetchYouTubeLongform(), fetchYouTubeFeed()]);
    const longformIds = longform.map((v) => v.id);

    const newest = longform[0];
    const feedMatch = feed.find((e) => e.id === newest.id);
    result.featured = {
      id: newest.id,
      title: newest.title,
      url: `https://www.youtube.com/watch?v=${newest.id}`,
      thumb: await pickThumb(newest.id, false),
      duration: newest.duration,
      views: newest.views,
      published: feedMatch ? feedMatch.published : null,
    };

    const shorts = feed.filter((e) => !longformIds.includes(e.id)).slice(0, 3);
    result.shorts = [];
    for (const s of shorts) {
      result.shorts.push({
        id: s.id,
        title: s.title.replace(/#\S+/g, '').replace(/\s{2,}/g, ' ').trim(),
        url: `https://www.youtube.com/shorts/${s.id}`,
        thumb: await pickThumb(s.id, true),
        views: s.views,
        published: s.published,
      });
    }
    ok++;
    console.log(`  ✔ featured "${result.featured.title}" + ${result.shorts.length} shorts`);
  } catch (e) {
    console.warn(`  ⚠ kept previous videos (${e.message})`);
  }

  if (ok === 0 && !previous.updated) {
    console.error('\n✖ Nothing fetched and no previous stats.json to keep — not writing.\n');
    process.exit(1);
  }

  fs.writeFileSync(OUT_JSON, JSON.stringify(result, null, 2));
  console.log(`\n✔ Saved → assets/stats.json (${ok}/3 sections refreshed)\n`);
}

main().catch((e) => {
  console.error(`\n✖ ${e.message}\n`);
  process.exit(1);
});
