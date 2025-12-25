// Background service worker - campaign sending, validation, and reporting
const DELAY_CONFIG = {
    modes: {
        instant: { maxRecipients: 2, delay: { min: 0, max: 0 } },
        quick: { maxRecipients: 4, delay: { min: 2, max: 5 } },
        normal: { maxRecipients: 5, delay: { min: 5, max: 10 } },
        batch: { maxRecipients: Infinity, delay: { min: 5, max: 10 }, batch: { size: 20, pauseBetweenBatches: 15 } },
    },
};

const VALIDATION_CACHE_TTL = 24 * 60 * 60 * 1000;

let activeCampaign = null;
let activeMedia = null; // kept in-memory only

// Primary message router
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    (async () => {
        await initialize();
        switch (request.action) {
            case 'contentjsToBackground': {
                const legacy = await sendImmediate(request);
                sendResponse(legacy);
                break;
            }
            case 'startSend': {
                const result = await startSend(request);
                sendResponse(result);
                break;
            }
            case 'getState': {
                sendResponse(getActiveCampaignState());
                break;
            }
            case 'pauseSend': {
                const result = await pauseSend();
                sendResponse(result);
                break;
            }
            case 'resumeSend': {
                const result = await resumeSend();
                sendResponse(result);
                break;
            }
            case 'stopSend': {
                const result = await stopSend();
                sendResponse(result);
                break;
            }
            case 'getHistory': {
                const history = await Database.getAll('campaigns');
                history.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                sendResponse(history);
                break;
            }
            default:
                sendResponse({ success: false, error: 'Unknown action' });
        }
    })().catch((err) => {
        console.error('Background error', err);
        sendResponse({ success: false, error: err?.message || 'Unexpected error' });
    });
    return true;
});

// ==================== DATABASE (IndexedDB) ====================
class Database {
    static DB_NAME = 'WAWebBridgeDB';
    static DB_VERSION = 1;
    static db = null;

    static async init() {
        if (this.db) return this.db;
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('campaigns')) {
                    const campaignStore = db.createObjectStore('campaigns', { keyPath: 'id' });
                    campaignStore.createIndex('status', 'status', { unique: false });
                    campaignStore.createIndex('createdAt', 'createdAt', { unique: false });
                }
                if (!db.objectStoreNames.contains('numberValidation')) {
                    const validationStore = db.createObjectStore('numberValidation', { keyPath: 'phone' });
                    validationStore.createIndex('expiresAt', 'expiresAt', { unique: false });
                }
            };
        });
    }

    static async put(storeName, data) {
        await this.init();
        const tx = this.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        return new Promise((resolve, reject) => {
            const req = store.put(data);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    static async get(storeName, key) {
        await this.init();
        const tx = this.db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        return new Promise((resolve, reject) => {
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    static async getAll(storeName) {
        await this.init();
        const tx = this.db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        return new Promise((resolve, reject) => {
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    static async delete(storeName, key) {
        await this.init();
        const tx = this.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        return new Promise((resolve, reject) => {
            const req = store.delete(key);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    static async getValidationCache(phone) {
        const cached = await this.get('numberValidation', phone);
        if (!cached) return null;
        if (new Date(cached.expiresAt) < new Date()) return null;
        return cached;
    }

    static async setValidationCache(phone, result) {
        const record = {
            phone,
            exists: !!result.exists,
            isBusiness: !!result.isBusiness,
            checkedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + VALIDATION_CACHE_TTL).toISOString(),
        };
        await this.put('numberValidation', record);
    }

    static async clearExpiredValidations() {
        await this.init();
        const now = new Date().toISOString();
        const tx = this.db.transaction('numberValidation', 'readwrite');
        const store = tx.objectStore('numberValidation');
        const index = store.index('expiresAt');
        const range = IDBKeyRange.upperBound(now);
        const req = index.openCursor(range);
        req.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                store.delete(cursor.primaryKey);
                cursor.continue();
            }
        };
    }
}

async function initialize() {
    await Database.init();
    await Database.clearExpiredValidations();

    if (!activeCampaign) {
        const campaigns = await Database.getAll('campaigns');
        const running = campaigns.find((c) => c.status === 'running');
        if (running) {
            running.status = 'paused';
            running.pausedAt = new Date().toISOString();
            await Database.put('campaigns', running);
        }
    }
}

// ==================== UTILITIES ====================
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function generateId(prefix = 'campaign') {
    return `${prefix}_${Date.now()}`;
}

function normalizePhone(phone) {
    return (phone || '').replace(/[^\d]/g, '');
}

function renderTemplate(template, recipient) {
    const data = {
        name: recipient.name || 'there',
        phone: recipient.phone || '',
        custom1: recipient.custom1 || '',
        custom2: recipient.custom2 || '',
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
    };
    return (template || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => (data[key] !== undefined ? data[key] : ''));
}

function getMode(recipientCount) {
    if (recipientCount <= DELAY_CONFIG.modes.instant.maxRecipients) return 'instant';
    if (recipientCount <= DELAY_CONFIG.modes.quick.maxRecipients) return 'quick';
    if (recipientCount <= DELAY_CONFIG.modes.normal.maxRecipients) return 'normal';
    return 'batch';
}

function calculateDelay(count) {
    const mode = getMode(count);
    const config = DELAY_CONFIG.modes[mode];
    if (mode === 'instant') return 0;
    const { min, max } = config.delay;
    let delay = min + Math.random() * (max - min);
    delay *= 0.9 + Math.random() * 0.2; // ±10%
    return Math.round(delay * 1000);
}

function checkBatchPause(state) {
    const mode = getMode(state.recipients.length);
    if (mode !== 'batch') return { shouldPause: false };
    const { size, pauseBetweenBatches } = DELAY_CONFIG.modes.batch.batch;
    const processed = state.progress.sent + state.progress.failed;
    if (processed > 0 && processed % size === 0) {
        return {
            shouldPause: true,
            duration: pauseBetweenBatches * 1000,
            batchNumber: processed / size,
            totalBatches: Math.ceil(state.recipients.length / size),
        };
    }
    return { shouldPause: false };
}

async function getWhatsappTab() {
    const [tab] = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
    return tab;
}

async function validateNumber(phone) {
    const tab = await getWhatsappTab();
    if (!tab) {
        return { exists: false, error: 'WHATSAPP_NOT_OPEN' };
    }
    try {
        const [{ result }] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            world: 'MAIN',
            func: async (phoneNumber) => {
                try {
                    if (!window.WWebJS || typeof window.WWebJS.checkNumberExists !== 'function') {
                        return { exists: false, error: 'CHECK_NOT_AVAILABLE' };
                    }
                    return await window.WWebJS.checkNumberExists(phoneNumber);
                } catch (err) {
                    return { exists: false, error: err?.message || 'VALIDATION_ERROR' };
                }
            },
            args: [phone],
        });
        return result || { exists: false };
    } catch (error) {
        return { exists: false, error: error?.message || 'VALIDATION_ERROR' };
    }
}

async function downloadMediaFromUrl(url, options = {}) {
    const reqOptions = Object.assign({ headers: { accept: 'image/* video/* text/* audio/* application/pdf ' } }, options);
    const response = await fetch(url, reqOptions);
    const mime = response.headers.get('Content-Type');
    const size = response.headers.get('Content-Length');
    const contentDisposition = response.headers.get('Content-Disposition');
    const name = contentDisposition ? contentDisposition.match(/((?<=filename=")(.*)(?="))/) : 'file';
    const arrayBuffer = await response.arrayBuffer();
    const data = arrayBufferToBase64Fast(arrayBuffer);
    return { data, mimetype: mime, filename: name, filesize: size || arrayBuffer.byteLength };
}

function arrayBufferToBase64Fast(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    const chunkSize = 32768;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
        binary += String.fromCharCode.apply(null, chunk);
    }
    return btoa(binary);
}

async function sendThroughWhatsapp(recipient, messageText, media) {
    const tab = await getWhatsappTab();
    if (!tab) {
        return { success: false, response: 'Whatsapp is not running, please open whatsapp.' };
    }

    const messageData = {
        action: 'backgroundToWhatsapp',
        text: messageText,
        receiver: recipient.phone,
        internalOptions: {},
        uid: generateId('msg'),
    };

    // Normalize legacy media payloads (older public API sends {mime,data,filename,filesize})
    const normalizedMedia = (() => {
        if (!media) return null;
        if (media.type === 'url' || media.type === 'file') return media;
        if (media.data) return { ...media, type: 'file' };
        if (media.url) return { ...media, type: 'url' };
        return null;
    })();

    if (normalizedMedia?.type === 'url') {
        try {
            messageData.internalOptions = { linkPreview: true };
            messageData.internalOptions.media = await downloadMediaFromUrl(normalizedMedia.url);
            messageData.internalOptions.caption = messageText;
            messageData.text = '';
        } catch (err) {
            return { success: false, response: 'Failed to fetch media', error: err?.message };
        }
    } else if (normalizedMedia?.type === 'file' && normalizedMedia.data) {
        messageData.internalOptions.media = {
            data: normalizedMedia.data,
            mimetype: normalizedMedia.mime,
            filename: normalizedMedia.filename,
            filesize: normalizedMedia.filesize,
        };
        messageData.internalOptions.caption = messageText;
        messageData.text = '';
    }

    try {
        const response = await chrome.tabs.sendMessage(tab.id, messageData);
        return response;
    } catch (error) {
        return { success: false, response: 'Error while sending message', error: error?.message };
    }
}

// ==================== CAMPAIGN FLOW ====================
async function startSend({ recipients = [], message, media }) {
    if (!recipients.length) return { success: false, error: 'No recipients provided' };

    const normalized = recipients
        .map((r) => ({
            phone: normalizePhone(r.phone),
            name: r.name || '',
            custom1: r.custom1 || '',
            custom2: r.custom2 || '',
            status: 'pending',
        }))
        .filter((r) => r.phone);

    const campaignId = generateId();
    const campaign = {
        id: campaignId,
        status: 'running',
        input: {
            message: message?.template || '',
            hasAttachment: !!media,
            attachmentType: media?.type || null,
            attachmentName: media?.type === 'url' ? media.url : media?.filename || null,
        },
        recipients: normalized,
        progress: { total: normalized.length, currentIndex: 0, sent: 0, failed: 0 },
        createdAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
        mode: getMode(normalized.length),
    };

    activeCampaign = campaign;
    activeMedia = media || null;
    await Database.put('campaigns', campaign);
    processQueue().catch((err) => console.error('processQueue error', err));
    return { success: true, campaignId };
}

async function processQueue() {
    while (
        activeCampaign &&
        activeCampaign.status === 'running' &&
        activeCampaign.progress.currentIndex < activeCampaign.recipients.length
    ) {
        const idx = activeCampaign.progress.currentIndex;
        const recipient = activeCampaign.recipients[idx];

        // Validation with cache
        recipient.status = 'validating';
        broadcastProgress();

        let validation = await Database.getValidationCache(recipient.phone);
        if (!validation) {
            const validationResult = await validateNumber(recipient.phone);
            validation = { phone: recipient.phone, exists: !!validationResult.exists, isBusiness: !!validationResult.isBusiness };
            await Database.setValidationCache(recipient.phone, validation);
        }

        if (!validation.exists) {
            recipient.status = 'invalid';
            recipient.error = 'Number not on WhatsApp';
            activeCampaign.progress.failed++;
        } else {
            // Send message
            recipient.status = 'sending';
            broadcastProgress();

            const personalized = renderTemplate(activeCampaign.input.message, recipient);
            const response = await sendThroughWhatsapp(recipient, personalized, activeMedia);

            if (response?.success) {
                recipient.status = 'sent';
                recipient.sentAt = new Date().toISOString();
                activeCampaign.progress.sent++;
            } else {
                recipient.status = 'failed';
                recipient.error = response?.response || 'Send failed';
                activeCampaign.progress.failed++;
            }
        }

        activeCampaign.progress.currentIndex++;
        activeCampaign.lastSentAt = new Date().toISOString();
        await Database.put('campaigns', activeCampaign);
        broadcastProgress();

        if (activeCampaign.progress.currentIndex >= activeCampaign.recipients.length) {
            break;
        }

        const batchPause = checkBatchPause(activeCampaign);
        if (batchPause.shouldPause) {
            broadcastStatus(`Batch ${batchPause.batchNumber}/${batchPause.totalBatches} complete. Pausing 15s...`);
            await sleep(batchPause.duration);
        }

        const delay = calculateDelay(activeCampaign.recipients.length);
        if (delay > 0) {
            broadcastStatus(`Next in ${Math.ceil(delay / 1000)}s`);
            await sleep(delay);
        }
    }

    if (activeCampaign && activeCampaign.status === 'running') {
        activeCampaign.status = 'completed';
        activeCampaign.completedAt = new Date().toISOString();
        await Database.put('campaigns', activeCampaign);
        activeMedia = null;
        broadcastProgress();
    }
}

async function pauseSend() {
    if (!activeCampaign || activeCampaign.status !== 'running') {
        return { success: false, error: 'No running campaign' };
    }
    activeCampaign.status = 'paused';
    activeCampaign.pausedAt = new Date().toISOString();
    await Database.put('campaigns', activeCampaign);
    broadcastProgress();
    return { success: true };
}

async function resumeSend() {
    if (!activeCampaign || activeCampaign.status !== 'paused') {
        return { success: false, error: 'No paused campaign' };
    }
    if (activeCampaign.input.hasAttachment && !activeMedia) {
        return { success: false, error: 'Attachment was lost. Please restart the send.' };
    }
    activeCampaign.status = 'running';
    await Database.put('campaigns', activeCampaign);
    processQueue().catch((err) => console.error('processQueue error', err));
    return { success: true };
}

async function stopSend() {
    if (!activeCampaign) return { success: true };
    activeCampaign.status = 'stopped';
    activeCampaign.stoppedAt = new Date().toISOString();
    await Database.put('campaigns', activeCampaign);
    activeMedia = null;
    broadcastProgress();
    return { success: true };
}

function getActiveCampaignState() {
    if (!activeCampaign) return null;
    const idx = activeCampaign.progress.currentIndex;
    const current = activeCampaign.recipients[idx] || null;
    return {
        campaignId: activeCampaign.id,
        status: activeCampaign.status,
        progress: activeCampaign.progress,
        currentRecipient: current,
        mode: activeCampaign.mode,
        input: activeCampaign.input,
        startedAt: activeCampaign.startedAt,
        completedAt: activeCampaign.completedAt,
        recipients: activeCampaign.recipients,
    };
}

function broadcastProgress() {
    if (!activeCampaign) return;
    const idx = activeCampaign.progress.currentIndex;
    const current = activeCampaign.recipients[idx] || null;
    chrome.runtime.sendMessage({
        action: 'progressUpdate',
        state: {
            campaignId: activeCampaign.id,
            status: activeCampaign.status,
            progress: activeCampaign.progress,
            currentRecipient: current,
            mode: activeCampaign.mode,
            input: activeCampaign.input,
            startedAt: activeCampaign.startedAt,
            completedAt: activeCampaign.completedAt,
            recipients: activeCampaign.recipients,
        },
    }).catch(() => {});
}

function broadcastStatus(message) {
    chrome.runtime.sendMessage({ action: 'statusUpdate', message }).catch(() => {});
}

// ==================== LEGACY SINGLE-SEND ====================
async function sendImmediate(msg) {
    const recipient = { phone: normalizePhone(msg.mobile || msg.receiver || '') };
    if (!recipient.phone) {
        return { success: false, response: 'Invalid phone number' };
    }
    const response = await sendThroughWhatsapp(recipient, msg.text || '', msg.url ? { type: 'url', url: msg.url } : msg.media);
    return response || { success: false, response: 'Unknown error' };
}

// Initialize once per service worker spin-up after definitions are ready
queueMicrotask(() => {
    initialize().catch((err) => console.error('Init error', err));
});
