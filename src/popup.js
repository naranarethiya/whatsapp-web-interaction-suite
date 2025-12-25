let parsedRecipients = [];
let currentState = null;
let selectedFile = null;

document.addEventListener('DOMContentLoaded', () => {
    wireTabs();
    wireInputs();
    loadState();
});

chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'progressUpdate') {
        currentState = message.state;
        renderReport(message.state);
    }
});

function wireTabs() {
    document.querySelectorAll('.tab').forEach((tab) => {
        tab.addEventListener('click', () => {
            const target = tab.getAttribute('data-tab');
            document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`${target}-tab`).classList.add('active');
        });
    });
}

function wireInputs() {
    const recipientsInput = document.getElementById('recipientsInput');
    recipientsInput.addEventListener('input', () => {
        parsedRecipients = parseRecipients(recipientsInput.value);
        updateRecipientUI();
    });

    document.getElementById('csvInput').addEventListener('change', handleCsvImport);

    document.querySelectorAll('input[name="attachmentType"]').forEach((radio) => {
        radio.addEventListener('change', () => {
            toggleAttachmentFields(radio.value);
        });
    });

    document.getElementById('attachmentFile').addEventListener('change', (e) => {
        selectedFile = e.target.files?.[0] || null;
    });

    document.getElementById('sendBtn').addEventListener('click', onSend);
    document.getElementById('pauseBtn').addEventListener('click', () => chrome.runtime.sendMessage({ action: 'pauseSend' }));
    document.getElementById('resumeBtn').addEventListener('click', () => chrome.runtime.sendMessage({ action: 'resumeSend' }));
    document.getElementById('stopBtn').addEventListener('click', () => chrome.runtime.sendMessage({ action: 'stopSend' }));
}

function getMode(count) {
    if (count <= 10) return { key: 'instant', label: 'Instant • No delays' };
    if (count <= 50) return { key: 'quick', label: 'Quick • 2-5 sec delay' };
    if (count <= 200) return { key: 'normal', label: 'Normal • 5-10 sec delay' };
    return { key: 'batch', label: 'Batch • 20/batch + 15s pause' };
}

function updateRecipientUI() {
    const countBadge = document.getElementById('recipientCount');
    countBadge.textContent = `${parsedRecipients.length} recipients`;
    const mode = getMode(parsedRecipients.length);
    document.getElementById('modeInfo').textContent = `Mode: ${mode.label}`;
    const sendBtn = document.getElementById('sendBtn');
    sendBtn.textContent = parsedRecipients.length ? `🚀 Send to ${parsedRecipients.length} recipients` : '🚀 Send';
}

function toggleAttachmentFields(type) {
    document.getElementById('attachmentUrlGroup').classList.toggle('hidden', type !== 'url');
    document.getElementById('attachmentFileGroup').classList.toggle('hidden', type !== 'file');
}

function parseRecipients(text) {
    const normalized = text
        .replace(/\r/g, '')
        .replace(/,\s*(?=\d{7,})/g, '|') // comma followed by another phone -> new entry
        .replace(/\n+/g, '|');
    const entries = normalized
        .split('|')
        .map((v) => v.trim())
        .filter(Boolean);
    const recipients = [];
    const seen = new Set();
    entries.forEach((entry) => {
        const parts = entry.split(',').map((p) => p.trim());
        const phone = (parts[0] || '').replace(/[^\d]/g, '');
        if (!phone || phone.length < 7 || phone.length > 15) return;
        if (seen.has(phone)) return;
        seen.add(phone);
        recipients.push({
            phone,
            name: parts[1] || '',
            custom1: parts[2] || '',
            custom2: parts[3] || '',
        });
    });
    return recipients;
}

async function handleCsvImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const rows = text.split(/\r?\n/).filter(Boolean);
    const header = rows[0].toLowerCase().includes('phone') ? rows.shift() : null;
    const recipients = rows.map((row) => {
        const cols = row.split(/[;,|\t]/).map((c) => c.trim());
        const phone = (cols[0] || '').replace(/[^\d]/g, '');
        return {
            phone,
            name: cols[1] || '',
            custom1: cols[2] || '',
            custom2: cols[3] || '',
        };
    });
    parsedRecipients = dedupe([...parsedRecipients, ...recipients]);
    const textarea = document.getElementById('recipientsInput');
    textarea.value = parsedRecipients.map((r) => [r.phone, r.name, r.custom1].filter(Boolean).join(',')).join('\n');
    updateRecipientUI();
}

function dedupe(list) {
    const seen = new Set();
    return list.filter((r) => {
        if (!r.phone || seen.has(r.phone)) return false;
        seen.add(r.phone);
        return true;
    });
}

async function onSend() {
    const statusEl = document.getElementById('sendStatus');
    statusEl.textContent = '';
    if (!parsedRecipients.length) {
        statusEl.textContent = 'Add at least one recipient.';
        return;
    }
    const message = document.getElementById('messageInput').value.trim();
    if (!message) {
        statusEl.textContent = 'Message cannot be empty.';
        return;
    }

    const attachmentType = document.querySelector('input[name="attachmentType"]:checked')?.value || 'none';
    let media = null;
    if (attachmentType === 'url') {
        const url = document.getElementById('attachmentUrl').value.trim();
        try {
            new URL(url);
            media = { type: 'url', url };
        } catch {
            statusEl.textContent = 'Enter a valid URL for attachment.';
            return;
        }
    }
    if (attachmentType === 'file') {
        if (!selectedFile) {
            statusEl.textContent = 'Select a file to attach.';
            return;
        }
        const base64 = await fileToBase64(selectedFile);
        media = {
            type: 'file',
            data: base64,
            mime: selectedFile.type || 'application/octet-stream',
            filename: selectedFile.name,
            filesize: selectedFile.size,
        };
    }

    const sendBtn = document.getElementById('sendBtn');
    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending...';
    statusEl.textContent = 'Starting send...';

    const response = await chrome.runtime.sendMessage({
        action: 'startSend',
        recipients: parsedRecipients,
        message: { template: message },
        media,
    });

    if (!response?.success) {
        statusEl.textContent = response?.error || 'Failed to start send.';
        sendBtn.disabled = false;
        sendBtn.textContent = '🚀 Send';
        return;
    }
    statusEl.textContent = 'Send started. Opening report...';
    switchToReportTab();
}

function switchToReportTab() {
    document.querySelector('[data-tab="report"]').click();
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function loadState() {
    const state = await chrome.runtime.sendMessage({ action: 'getState' });
    if (state) {
        currentState = state;
        renderReport(state);
        switchToReportTab();
    } else {
        renderReport(null);
    }
}

function renderReport(state) {
    const statusEl = document.getElementById('campaignStatus');
    const modeEl = document.getElementById('campaignMode');
    const fill = document.getElementById('progressFill');
    const sentEl = document.getElementById('sentCount');
    const failedEl = document.getElementById('failedCount');
    const pendingEl = document.getElementById('pendingCount');
    const currentEl = document.getElementById('currentRecipient');
    const resultsBody = document.getElementById('resultsBody');

    if (!state) {
        statusEl.textContent = 'Idle';
        modeEl.textContent = '-';
        fill.style.width = '0%';
        sentEl.textContent = '0';
        failedEl.textContent = '0';
        pendingEl.textContent = '0';
        currentEl.textContent = 'Current: -';
        resultsBody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#6b7280;">No data yet</td></tr>`;
        return;
    }

    statusEl.textContent = state.status;
    modeEl.textContent = state.mode || '-';

    const progress = state.progress || { total: 0, sent: 0, failed: 0, currentIndex: 0 };
    const total = progress.total || 0;
    const done = progress.currentIndex || 0;
    const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
    fill.style.width = `${pct}%`;

    sentEl.textContent = progress.sent || 0;
    failedEl.textContent = progress.failed || 0;
    pendingEl.textContent = Math.max(0, (progress.total || 0) - (progress.sent || 0) - (progress.failed || 0));

    const current = state.currentRecipient;
    currentEl.textContent = current ? `Current: ${current.phone}${current.name ? ' (' + current.name + ')' : ''}` : 'Current: -';

    const rows = (state.recipients || []).slice(0, 20).map((r, idx) => {
        return `<tr>
            <td>${idx + 1}</td>
            <td>${r.phone}</td>
            <td>${r.name || 'there'}</td>
            <td>${r.status || 'pending'}</td>
        </tr>`;
    });
    resultsBody.innerHTML = rows.length ? rows.join('') : `<tr><td colspan="4" style="text-align:center;color:#6b7280;">No data yet</td></tr>`;

    const isRunning = state.status === 'running';
    document.getElementById('pauseBtn').disabled = !isRunning;
    document.getElementById('resumeBtn').disabled = state.status !== 'paused';
    document.getElementById('stopBtn').disabled = state.status === 'completed' || state.status === 'stopped';
}