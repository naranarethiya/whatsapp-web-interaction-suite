const messageAction = 'webAppToContentjs';
const sendResponseEvent = 'whatsappSendResponse';
window.whatsappWebSuite = {};

// Promise tracking system
const pendingPromises = new Map();

// Generate unique ID for tracking messages
function generateUniqueId() {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substr(2, 5);
    return timestamp + randomStr;
}

window.whatsappWebSuite.sendTextMessage = function(mobile, text) {

    let sendTextMessage = {
        'mobile': mobile,
        'text': text,
    };

    console.log("In sendTextMessage", sendTextMessage);

    if(!isValidMobile(mobile)) {
        console.error("Invalid mobile number. Use only numbers, no spaces or special characters, and include the country code.");
        const errorResponse = triggerMessageResponse("Mobile number is not valid", false, message);
        return Promise.reject(errorResponse);
    }

    if(isEmptyString(text)) {
        console.error("Text is required.");
        const errorResponse = triggerMessageResponse("Text is required.", false, message);
        return Promise.reject(errorResponse);
    }

    const uid = generateUniqueId();
    
    // Create promise and store it
    const promise = new Promise((resolve, reject) => {
        pendingPromises.set(uid, { resolve, reject });
    });

    window.postMessage({
        action: messageAction,
        mobile: mobile,
        text: text,
        uid: uid,
    }, "*");

    return promise;
}


window.whatsappWebSuite.sendUrlMediaMessage = function(mobile, url, text) {

    let message = {
        'mobile': mobile,
        'text': text,
        'url': url,
    };

    if(!isValidMobile(mobile)) {
        console.error("Mobile number is not valid");
        const errorResponse = triggerMessageResponse("Mobile number is not valid", false, message);
        return Promise.reject(errorResponse);
    }

    if(!isURL(url)) {
        console.error("URL is not valid URL.");
        const errorResponse = triggerMessageResponse("URL is not valid URL.", false, message);
        return Promise.reject(errorResponse);
    }

    const uid = generateUniqueId();
    
    // Create promise and store it
    const promise = new Promise((resolve, reject) => {
        pendingPromises.set(uid, { resolve, reject });
    });

    window.postMessage({
        action: messageAction,
        mobile: mobile,
        text: text,
        url: url,
        uid: uid,
    }, "*");

    return promise;
}

window.whatsappWebSuite.sendBase64Message = function(mobile, base64Data, mime, filename, text) {

    let message = {
        'mobile': mobile,
        'text': text,
        'base64Data': base64Data,
        'mime': mime,
    };

    if(!isValidMobile(mobile)) {
        console.error("Mobile number is not valid");
        const errorResponse = triggerMessageResponse("Mobile number is not valid", false, message);
        return Promise.reject(errorResponse);
    }

    if(isEmptyString(mime)) {
        console.error("mime is required.");
        const errorResponse = triggerMessageResponse("mime is required.", false, message);
        return Promise.reject(errorResponse);
    }

    if(isEmptyString(filename)) {
        console.error("filename is required.");
        const errorResponse = triggerMessageResponse("filename is required.", false, message);
        return Promise.reject(errorResponse);
    }

    const uid = generateUniqueId();
    
    // Create promise and store it
    const promise = new Promise((resolve, reject) => {
        pendingPromises.set(uid, { resolve, reject });
    });

    // Extract raw base64 data (single pass cleaning, no redundant validation)
    let rawBase64Data;
    if (base64Data.startsWith('data:')) {
        // Extract base64 part from data URL
        rawBase64Data = base64Data.replace(/^data:[^;]+;base64,/, '');
    } else {
        rawBase64Data = base64Data;
    }
    
    // Single pass cleaning - remove whitespace and ensure padding
    rawBase64Data = rawBase64Data.replace(/\s/g, '');
    const remainder = rawBase64Data.length % 4;
    if (remainder) {
        rawBase64Data += '='.repeat(4 - remainder);
    }

    // Calculate file size from base64 length (faster than decoding)
    const estimatedFileSize = Math.floor(rawBase64Data.length * 0.75);

    window.postMessage({
        action: messageAction,
        mobile: mobile,
        text: text,
        uid: uid,
        media: {
            mime: mime,
            data: rawBase64Data,
            filename: filename,
            filesize: estimatedFileSize
        },
    }, "*");

    return promise;
}

// Listen for responses and resolve/reject promises
document.addEventListener(sendResponseEvent, function(e) {
    const response = e.detail;
    const uid = response.uid;
    
    if (uid && pendingPromises.has(uid)) {
        const { resolve, reject } = pendingPromises.get(uid);
        pendingPromises.delete(uid);
        
        if (response.success) {
            resolve(response);
        } else {
            reject(response);
        }
    }
});

function triggerMessageResponse(response, isSuccess, message, uid = null) {
    let data = { message: message, success: isSuccess, response: response, uid: uid };
    document.dispatchEvent(new CustomEvent(sendResponseEvent,  { detail: data }));
    return data;
}

function isValidMobile(number) {
    var pattern = /^\d{7,15}$/;
    return pattern.test(number);
}

function isEmptyString(input) {
    return input.trim() === '';
}

function isBlob(data) {
    return data instanceof Blob;
}
  
// Check if the data contains Base64 data - optimized for speed
function isBase64(data) {
    if (typeof data !== 'string') return false;
    
    // Quick check for data URL format (don't validate the actual base64 content)
    // This is much faster and the actual decoding will happen later anyway
    return /^data:.+\/.+;base64,/.test(data);
}

function isURL(str) {
    try {
        new URL(str);
        return true;
    } catch (error) {
        return false;
    }
}

// Optimized base64 cleaning - minimal processing, skip unnecessary validation
// The browser's native base64 decoder in fetch API will handle validation
function cleanBase64Data(base64Data) {
    // Fast path: if data looks valid, return immediately
    if (!base64Data || typeof base64Data !== 'string') {
        return base64Data;
    }
    
    // Remove any whitespace and newlines (single pass)
    let cleaned = base64Data.replace(/\s/g, '');
    
    // Remove any data URL prefix if present
    if (cleaned.startsWith('data:')) {
        cleaned = cleaned.replace(/^data:[^;]+;base64,/, '');
    }
    
    // Only clean invalid characters if the data contains them
    // This regex check is faster than always running replace
    if (/[^A-Za-z0-9+/=]/.test(cleaned)) {
        cleaned = cleaned.replace(/[^A-Za-z0-9+/=]/g, '');
    }
    
    // Ensure proper base64 padding
    const remainder = cleaned.length % 4;
    if (remainder) {
        cleaned += '='.repeat(4 - remainder);
    }
    
    return cleaned;
}

// Skip chunk validation for large files - it's redundant
// The browser's native fetch API will validate when decoding
function validateLargeBase64(base64Data) {
    // Just clean the data without expensive chunk-by-chunk validation
    let cleaned = base64Data.replace(/[^A-Za-z0-9+/=]/g, '');
    
    // Ensure proper padding
    const remainder = cleaned.length % 4;
    if (remainder) {
        cleaned += '='.repeat(4 - remainder);
    }
    
    return cleaned;
}

// Fast file size estimation from base64 (no decoding needed)
function getDiskSizeFromBase64(base64Data) {
    // Remove metadata prefix if present
    const base64WithoutPrefix = base64Data.replace(/^data:[^;]+;base64,/, '');
    
    // Remove whitespace
    const cleanLength = base64WithoutPrefix.replace(/\s/g, '').length;
    
    // Base64 encoding adds ~33% overhead, so multiply by 0.75 to get original size
    // Account for padding characters
    const paddingChars = (base64WithoutPrefix.match(/=+$/) || [''])[0].length;
    
    return Math.floor((cleanLength * 3) / 4) - paddingChars;
}


function base64MimeType(encoded) {
    var result = null;

    if (typeof encoded !== 'string') {
        return result;
    }

    var mime = encoded.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/);

    if (mime && mime.length) {
        result = mime[1];
    }

    return result;
}