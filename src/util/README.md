# WhatsApp Web injection scripts

This folder contains the split from [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) for use in the extension.

## File roles

| File | Purpose |
|------|--------|
| **whatsapp-store.js** | Bootstrap: waits for `window.Store`, runs `setWindowStore()` (Store.js), then calls `loadUtils()` and `applyOverrides()`. Listens for `whatsappContentToWhatsappJs`. |
| **whatsapp-upstream.js** | Vanilla upstream `Utils.js` converted to `window.loadUtils = function() { ... }`. **Replace this file when upstream updates** (see below). |
| **whatsapp-overrides.js** | Extension-only customizations: `sendWhatsappMessage`, performance helpers, `mediaInfoToFileAsync`, and overrides for media/sticker handling. |
| **upstream/Utils.js** | Raw copy of upstream `Utils.js` from GitHub (for diffing). Updated by `npm run sync-upstream`. |

## Updating from whatsapp-web.js

When [Utils.js](https://github.com/pedroslopez/whatsapp-web.js/blob/main/src/util/Injected/Utils.js) changes:

1. Run:
   ```bash
   npm run sync-upstream
   ```
2. This fetches the latest `Utils.js`, saves a raw copy to `upstream/Utils.js`, and writes the converted script to `whatsapp-upstream.js`.
3. Review changes: `git diff src/util/whatsapp-upstream.js`
4. Test the extension on WhatsApp Web. If something breaks, adjust **whatsapp-overrides.js** (e.g. add or fix an override) rather than editing `whatsapp-upstream.js`.

Your customizations live only in **whatsapp-overrides.js**, so upstream updates are a single file replace plus any override fixes.
