/**
 * WA Web Bridge extension overrides.
 * Applied after loadUtils() so our customizations take precedence over upstream.
 * Keep only extension-specific and performance customizations here.
 */
window.applyOverrides = function () {
    if (!window.WWebJS) return;

    // --- Performance debugging (set to true to log timing) ---
    window.WWebJS.debugPerformance = false;
    window.WWebJS.perfLog = function (label, startTime) {
        if (window.WWebJS.debugPerformance) {
            console.log('[WWebJS Performance] ' + label + ': ' + (Date.now() - startTime) + 'ms');
        }
    };

    // --- Extension: send message from content script and dispatch response event ---
    const responseEvent = 'WhatsappjsResponse';
    window.WWebJS.sendWhatsappMessage = async function (receiver, text, options, sendSeen, uid) {
        try {
            const chatWid = window.Store.WidFactory.createWid(receiver + '@c.us');
            const chat = await window.Store.Chat.find(chatWid);
            const msg = await window.WWebJS.sendMessage(chat, text, options || {});
            console.log('window.WWebJS.sendMessage response:', msg);
            document.dispatchEvent(new CustomEvent(responseEvent, {
                detail: { success: true, response: 'Message sent successfully', uid: uid }
            }));
        } catch (error) {
            console.error('window.WWebJS.sendMessage error:', error);
            document.dispatchEvent(new CustomEvent(responseEvent, {
                detail: {
                    success: false,
                    response: (error && error.message) || 'Error while sending message',
                    uid: uid
                }
            }));
        }
    };

    // --- Faster async base64 → File (used by sticker/media below) ---
    window.WWebJS.mediaInfoToFileAsync = async function (arg) {
        const { data, mimetype, filename } = arg;
        try {
            const response = await fetch('data:' + mimetype + ';base64,' + data);
            const blob = await response.blob();
            return new File([blob], filename, { type: mimetype, lastModified: Date.now() });
        } catch (e) {
            return window.WWebJS.mediaInfoToFile(arg);
        }
    };

    // --- Optimized sync base64 → File (chunked loop) ---
    window.WWebJS.mediaInfoToFile = function (arg) {
        const { data, mimetype, filename } = arg;
        const byteCharacters = atob(data);
        const byteNumbers = new Uint8Array(byteCharacters.length);
        const chunkSize = 65536;
        for (let offset = 0; offset < byteCharacters.length; offset += chunkSize) {
            const end = Math.min(offset + chunkSize, byteCharacters.length);
            for (let i = offset; i < end; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
        }
        const blob = new Blob([byteNumbers], { type: mimetype });
        return new File([blob], filename, { type: mimetype, lastModified: Date.now() });
    };

    // --- toStickerData: use async file conversion ---
    window.WWebJS.toStickerData = async function (mediaInfo) {
        if (mediaInfo.mimetype === 'image/webp') return mediaInfo;
        const file = await window.WWebJS.mediaInfoToFileAsync(mediaInfo);
        const webpSticker = await window.Store.StickerTools.toWebpSticker(file);
        const webpBuffer = await webpSticker.arrayBuffer();
        const data = window.WWebJS.arrayBufferToBase64(webpBuffer);
        return { mimetype: 'image/webp', data: data };
    };

    // --- processStickerData: use async file conversion; keep uploadQpl if available ---
    window.WWebJS.processStickerData = async function (mediaInfo) {
        if (mediaInfo.mimetype !== 'image/webp') throw new Error('Invalid media type');
        const file = await window.WWebJS.mediaInfoToFileAsync(mediaInfo);
        const filehash = await window.WWebJS.getFileHash(file);
        const mediaKey = await window.WWebJS.generateHash(32);
        const controller = new AbortController();
        const uploadOpts = {
            blob: file,
            type: 'sticker',
            signal: controller.signal,
            mediaKey: mediaKey
        };
        if (window.Store.MediaUpload && typeof window.Store.MediaUpload.startMediaUploadQpl === 'function') {
            uploadOpts.uploadQpl = window.Store.MediaUpload.startMediaUploadQpl({ entryPoint: 'MediaUpload' });
        }
        const uploadedInfo = await window.Store.UploadUtils.encryptAndUpload(uploadOpts);
        return {
            ...uploadedInfo,
            clientUrl: uploadedInfo.url,
            deprecatedMms3Url: uploadedInfo.url,
            uploadhash: uploadedInfo.encFilehash,
            size: file.size,
            type: 'sticker',
            filehash: filehash
        };
    };

    // --- processMediaData: use async file conversion + optional perf logging ---
    window.WWebJS.processMediaData = async function (mediaInfo, opts) {
        const startTime = Date.now();
        const file = await window.WWebJS.mediaInfoToFileAsync(mediaInfo);
        window.WWebJS.perfLog('Base64 to File conversion', startTime);
        const opaqueStart = Date.now();
        const opaqueData = await window.Store.OpaqueData.createFromData(file, file.type);
        window.WWebJS.perfLog('OpaqueData creation', opaqueStart);
        const mediaParams = {
            asSticker: opts.forceSticker,
            asGif: opts.forceGif,
            isPtt: opts.forceVoice,
            asDocument: opts.forceDocument
        };
        if (opts.forceMediaHd && file.type.indexOf('image/') === 0) {
            mediaParams.maxDimension = 2560;
        }
        const mediaPrep = window.Store.MediaPrep.prepRawMedia(opaqueData, mediaParams);
        const mediaData = await mediaPrep.waitForPrep();
        const mediaObject = window.Store.MediaObject.getOrCreateMediaObject(mediaData.filehash);
        const mediaType = window.Store.MediaTypes.msgToMediaType({
            type: mediaData.type,
            isGif: mediaData.isGif,
            isNewsletter: opts.sendToChannel
        });
        if ((opts.forceVoice && mediaData.type === 'ptt') || (opts.sendToStatus && mediaData.type === 'audio')) {
            const waveform = mediaObject.contentInfo && mediaObject.contentInfo.waveform;
            mediaData.waveform = waveform || await window.WWebJS.generateWaveform(file);
        }
        if (!(mediaData.mediaBlob instanceof window.Store.OpaqueData)) {
            mediaData.mediaBlob = await window.Store.OpaqueData.createFromData(
                mediaData.mediaBlob,
                mediaData.mediaBlob.type
            );
        }
        mediaData.renderableUrl = mediaData.mediaBlob.url();
        mediaObject.consolidate(mediaData.toJSON());
        mediaData.mediaBlob.autorelease();
        if (window.Store.MediaDataUtils && window.Store.MediaDataUtils.shouldUseMediaCache &&
            window.Store.MediaTypes.castToV4(mediaObject.type) !== undefined) {
            const shouldUse = window.Store.MediaDataUtils.shouldUseMediaCache(
                window.Store.MediaTypes.castToV4(mediaObject.type)
            );
            if (shouldUse && mediaData.mediaBlob instanceof window.Store.OpaqueData && window.Store.BlobCache && window.Store.BlobCache.InMemoryMediaBlobCache) {
                const formData = mediaData.mediaBlob.formData();
                window.Store.BlobCache.InMemoryMediaBlobCache.put(mediaObject.filehash, formData);
            }
        }
        const dataToUpload = {
            mimetype: mediaData.mimetype,
            mediaObject: mediaObject,
            mediaType: mediaType,
            calculateToken: opts.sendToChannel ? window.Store.SendChannelMessage.getRandomFilehash : undefined
        };
        if (!opts.sendToChannel) delete dataToUpload.calculateToken;
        const uploadStart = Date.now();
        const uploadedMedia = !opts.sendToChannel
            ? await window.Store.MediaUpload.uploadMedia(dataToUpload)
            : await window.Store.MediaUpload.uploadUnencryptedMedia(dataToUpload);
        window.WWebJS.perfLog('Media upload to WhatsApp servers', uploadStart);
        const mediaEntry = uploadedMedia.mediaEntry;
        if (!mediaEntry) throw new Error('upload failed: media entry was not created');
        mediaData.set({
            clientUrl: mediaEntry.mmsUrl,
            deprecatedMms3Url: mediaEntry.deprecatedMms3Url,
            directPath: mediaEntry.directPath,
            mediaKey: mediaEntry.mediaKey,
            mediaKeyTimestamp: mediaEntry.mediaKeyTimestamp,
            filehash: mediaObject.filehash,
            encFilehash: mediaEntry.encFilehash,
            uploadhash: mediaEntry.uploadHash,
            size: mediaObject.size,
            streamingSidecar: mediaEntry.sidecar,
            firstFrameSidecar: mediaEntry.firstFrameSidecar,
            mediaHandle: opts.sendToChannel ? mediaEntry.handle : null
        });
        return mediaData;
    };
};
