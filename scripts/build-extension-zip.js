#!/usr/bin/env node
/**
 * Builds a .zip package for Chrome Web Store upload.
 * Only includes files required by the extension (manifest, scripts, icons, popup).
 *
 * Usage: node scripts/build-extension-zip.js
 * Or: npm run build:zip
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import archiver from 'archiver';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Files and dirs to include (relative to project root). Built from manifest + popup.
const INCLUDED_FILES = [
    'manifest.json',
    'popup.html',
    'icon-128.png',
    'src/background.js',
    'src/content.js',
    'src/webapp.js',
    'src/popup.js',
    'src/whatsappContent.js',
    'src/moduleraid.js',
    'src/jquery-3.7.0.min.js',
    'src/util/whatsapp-store.js',
    'src/util/whatsapp-upstream.js',
    'src/util/whatsapp-overrides.js',
];

function getVersion() {
    const p = path.join(ROOT, 'manifest.json');
    const raw = fs.readFileSync(p, 'utf8');
    const m = raw.match(/"version"\s*:\s*"([^"]+)"/);
    return m ? m[1] : '0.0.0';
}

function ensureFile(filePath) {
    const full = path.join(ROOT, filePath);
    if (!fs.existsSync(full)) {
        throw new Error('Required file missing: ' + filePath);
    }
}

async function main() {
    const version = getVersion();
    const outDir = path.join(ROOT, 'dist');
    const zipName = `wa-web-bridge-v${version}.zip`;
    const zipPath = path.join(outDir, zipName);

    // Validate required files (icon is optional for store but manifest references it)
    const required = INCLUDED_FILES.filter((f) => f !== 'icon-128.png');
    for (const f of required) {
        ensureFile(f);
    }
    const missingOptional = INCLUDED_FILES.filter((f) => !fs.existsSync(path.join(ROOT, f)));
    if (missingOptional.length) {
        console.warn('Warning: optional file(s) not found (will be omitted):', missingOptional.join(', '));
    }

    const toAdd = INCLUDED_FILES.filter((f) => fs.existsSync(path.join(ROOT, f)));
    fs.mkdirSync(outDir, { recursive: true });

    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
        console.log('Created:', path.relative(ROOT, zipPath));
        console.log('Size:', (archive.pointer() / 1024).toFixed(1) + ' KB');
        console.log('Files:', toAdd.length);
    });

    archive.on('error', (err) => {
        throw err;
    });

    archive.pipe(output);

    for (const file of toAdd) {
        const full = path.join(ROOT, file);
        archive.file(full, { name: file });
    }

    await archive.finalize();
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
