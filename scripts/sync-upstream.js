#!/usr/bin/env node
/**
 * Fetches the latest Utils.js from whatsapp-web.js and converts it for use in this extension.
 * - Saves raw file to src/util/upstream/Utils.js (for diffing)
 * - Converts to window.loadUtils and writes src/util/whatsapp-upstream.js (for injection)
 *
 * Usage: node scripts/sync-upstream.js
 * Or: npm run sync-upstream
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const UPSTREAM_URL = 'https://raw.githubusercontent.com/pedroslopez/whatsapp-web.js/main/src/util/Injected/Utils.js';
const ROOT = path.resolve(__dirname, '..');
const UPSTREAM_RAW = path.join(ROOT, 'src/util/upstream/Utils.js');
const UPSTREAM_CONVERTED = path.join(ROOT, 'src/util/whatsapp-upstream.js');

function fetch(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
            }
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

function convertToLoadUtils(raw) {
    // Convert Node-style export to browser global
    let converted = raw.replace(/^\s*exports\.LoadUtils\s*=\s*\(\)\s*=>\s*\{/m, 'window.loadUtils = function() {');
    if (converted === raw) {
        throw new Error('Could not find exports.LoadUtils in upstream file');
    }
    return converted;
}

async function main() {
    console.log('Fetching upstream Utils.js...');
    let raw;
    try {
        raw = await fetch(UPSTREAM_URL);
    } catch (err) {
    console.error('Fetch failed:', err.message);
    process.exit(1);
    }

    fs.mkdirSync(path.dirname(UPSTREAM_RAW), { recursive: true });
    fs.writeFileSync(UPSTREAM_RAW, raw, 'utf8');
    console.log('Saved raw to', path.relative(ROOT, UPSTREAM_RAW));

    const converted = convertToLoadUtils(raw);
    fs.writeFileSync(UPSTREAM_CONVERTED, converted, 'utf8');
    console.log('Saved converted to', path.relative(ROOT, UPSTREAM_CONVERTED));

    console.log('Done.');
    console.log('Review changes: git diff src/util/whatsapp-upstream.js');
    console.log('Or compare raw upstream: git diff src/util/upstream/Utils.js');
}

main();
