/**
 * fetch-instagram.mjs — pull Slim's latest Instagram posts into the site.
 *
 * Uses the official Instagram Graph API (Instagram API with Instagram Login).
 * Downloads each post image LOCALLY into assets/ig/ so the gallery never breaks
 * when Instagram's CDN URLs expire, and writes assets/instagram.json which the
 * gallery reads at page load.
 *
 * Run:  node scripts/fetch-instagram.mjs
 * Needs: IG_ACCESS_TOKEN in your environment or in a .env file (see .env.example).
 *
 * Dependency-free: uses Node's built-in https module (works on Node 14+).
 */

import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const IG_DIR = path.join(ROOT, 'assets', 'ig');
const OUT_JSON = path.join(ROOT, 'assets', 'instagram.json');

/* ---------- tiny .env loader (no dependency) ---------- */
function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}
loadEnv();

const TOKEN = process.env.IG_ACCESS_TOKEN;
const LIMIT = Number(process.env.IG_LIMIT || 12);

if (!TOKEN) {
  console.error('\n✖ Missing IG_ACCESS_TOKEN. Copy .env.example to .env and add your token.\n');
  process.exit(1);
}

/* ---------- promisified https GET ---------- */
function getJSON(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            const json = JSON.parse(body);
            if (json.error) return reject(new Error(json.error.message));
            resolve(json);
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.headers.location) {
          // follow redirect (IG CDN often 302s)
          file.close();
          return download(res.headers.location, dest).then(resolve, reject);
        }
        if (res.statusCode !== 200) {
          file.close();
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
      })
      .on('error', (err) => {
        fs.unlink(dest, () => reject(err));
      });
  });
}

/* ---------- main ---------- */
async function main() {
  console.log('→ Fetching latest Instagram media…');
  const fields = 'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp';
  const url = `https://graph.instagram.com/me/media?fields=${fields}&limit=${LIMIT}&access_token=${TOKEN}`;

  const { data } = await getJSON(url);
  if (!Array.isArray(data) || data.length === 0) {
    console.warn('⚠ No media returned. Leaving the existing gallery in place.');
    return;
  }

  fs.mkdirSync(IG_DIR, { recursive: true });

  const items = [];
  for (const post of data) {
    // videos expose a still in thumbnail_url; images use media_url
    const imgUrl = post.media_type === 'VIDEO' ? post.thumbnail_url : post.media_url;
    if (!imgUrl) continue;

    const file = `${post.id}.jpg`;
    try {
      await download(imgUrl, path.join(IG_DIR, file));
      items.push({
        id: post.id,
        src: `assets/ig/${file}`,
        permalink: post.permalink,
        caption: (post.caption || '').split('\n')[0].slice(0, 140),
        type: post.media_type,
        timestamp: post.timestamp,
      });
      process.stdout.write('.');
    } catch (e) {
      console.warn(`\n  skipped ${post.id}: ${e.message}`);
    }
  }

  fs.writeFileSync(OUT_JSON, JSON.stringify({ updated: new Date().toISOString(), items }, null, 2));
  console.log(`\n✔ Saved ${items.length} posts → assets/instagram.json`);
  console.log('  (Re-run anytime Slim posts. Token refresh reminder below.)\n');

  // Long-lived tokens last ~60 days. Refresh proactively so it never lapses.
  try {
    const refresh = await getJSON(
      `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${TOKEN}`
    );
    if (refresh.expires_in) {
      const days = Math.round(refresh.expires_in / 86400);
      console.log(`ℹ Token refreshed — valid ~${days} more days.`);
      if (refresh.access_token && refresh.access_token !== TOKEN) {
        console.log('  A new token string was issued. Update IG_ACCESS_TOKEN in .env:');
        console.log(`  ${refresh.access_token}\n`);
      }
    }
  } catch (e) {
    console.warn(`ℹ Token refresh check skipped: ${e.message}`);
  }
}

main().catch((e) => {
  console.error(`\n✖ ${e.message}\n`);
  process.exit(1);
});
