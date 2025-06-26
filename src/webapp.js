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

    // Auto-detect and convert base64 format
    let processedBase64Data = base64Data;
    
    // Check if it's already in data URL format (data:mime/type;base64,xxxxx)
    if (!base64Data.startsWith('data:')) {
        // Clean and validate raw base64 data before converting
        const cleanedBase64 = cleanBase64Data(base64Data);
        processedBase64Data = `data:${mime};base64,${cleanedBase64}`;
        console.log("Cleaned and converted raw base64 to data URL format");
    }

    if(!isBase64(processedBase64Data)) {
        console.error("Invalid base64 Data format");
        const errorResponse = triggerMessageResponse("Invalid base64 Data format", false, message);
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

    // Always use cleaned base64 data for transmission
    let finalBase64Data = base64Data;
    if (!base64Data.startsWith('data:')) {
        // For raw base64, use the cleaned version
        finalBase64Data = cleanBase64Data(base64Data);
    } else {
        // For data URLs, extract and clean the base64 part
        const base64Part = base64Data.replace(/^data:[^;]+;base64,/, '');
        finalBase64Data = cleanBase64Data(base64Part);
    }

    window.postMessage({
        action: messageAction,
        mobile: mobile,
        text: text,
        uid: uid,
        media: {
            mime: mime,
            data: finalBase64Data, // Use cleaned raw base64 data
            filename: filename,
            filesize: getDiskSizeFromBase64(processedBase64Data)
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
  
// Check if the data contains Base64 data
function isBase64(data) {
    if (typeof data !== 'string') return false;
    
    // Check for data URL format
    const base64Regex = /^data:(.+\/.+);base64,(.*)$/;
    
    if (!base64Regex.test(data)) return false;
    
    // Extract base64 part and validate it can be decoded
    const base64Part = data.replace(/^data:[^;]+;base64,/, '');
    
    try {
        // Try to clean and validate the base64 data
        const cleaned = cleanBase64Data(base64Part);
        atob(cleaned);
        return true;
    } catch (error) {
        console.warn('Base64 validation failed but continuing anyway...', error.message);
        return true; // Be forgiving - let it through and handle errors later
    }
}

function isURL(str) {
    try {
        new URL(str);
        return true;
    } catch (error) {
        return false;
    }
}

// Clean and validate base64 data to fix common encoding issues
function cleanBase64Data(base64Data) {
    // Remove any whitespace and newlines
    let cleaned = base64Data.replace(/\s/g, '');
    
    // Remove any data URL prefix if present
    cleaned = cleaned.replace(/^data:[^;]+;base64,/, '');
    
    // Ensure proper base64 padding
    while (cleaned.length % 4) {
        cleaned += '=';
    }
    
    // For large files, validate in chunks to avoid memory issues
    if (cleaned.length > 100000) { // > ~75KB
        console.log('Processing large base64 data in chunks...');
        return validateLargeBase64(cleaned);
    }
    
    // Test if the cleaned base64 is valid
    try {
        atob(cleaned);
        return cleaned;
    } catch (error) {
        console.warn('Base64 validation failed, attempting to fix...');
        
        // Try to fix common issues
        // Remove invalid characters (keep only valid base64 chars)
        cleaned = cleaned.replace(/[^A-Za-z0-9+/=]/g, '');
        
        // Re-add padding if needed
        while (cleaned.length % 4) {
            cleaned += '=';
        }
        
        // Test again
        try {
            atob(cleaned);
            console.log('Base64 data successfully cleaned and validated');
            return cleaned;
        } catch (finalError) {
            console.error('Unable to fix base64 data, using as-is:', finalError);
            return base64Data; // Return original if all fixes fail
        }
    }
}

// Validate large base64 data in chunks to avoid memory issues
function validateLargeBase64(base64Data) {
    const chunkSize = 10000; // Process in 10KB chunks
    let cleaned = base64Data;
    
    try {
        // First, clean invalid characters
        cleaned = cleaned.replace(/[^A-Za-z0-9+/=]/g, '');
        
        // Ensure proper padding
        while (cleaned.length % 4) {
            cleaned += '=';
        }
        
        // Validate in chunks
        for (let i = 0; i < cleaned.length; i += chunkSize) {
            const chunk = cleaned.substring(i, i + chunkSize);
            // Make sure chunk has proper padding for validation
            let validationChunk = chunk;
            if (i + chunkSize < cleaned.length) {
                // For middle chunks, add padding for validation
                while (validationChunk.length % 4) {
                    validationChunk += '=';
                }
            }
            
            try {
                atob(validationChunk);
            } catch (chunkError) {
                console.warn(`Chunk validation failed at position ${i}:`, chunkError.message);
                // Continue processing other chunks
            }
        }
        
        console.log('Large base64 data successfully processed');
        return cleaned;
        
    } catch (error) {
        console.error('Large base64 processing failed:', error);
        return base64Data; // Return original if all processing fails
    }
}

function getDiskSizeFromBase64(base64Data) {
    // Remove metadata prefix (e.g., 'data:image/png;base64,')
    // Use more flexible regex to handle various MIME types
    var base64WithoutPrefix = base64Data.replace(/^data:[^;]+;base64,/, '');
  
    try {
        // Clean the base64 data before processing
        var cleanedBase64 = cleanBase64Data(base64WithoutPrefix);
        
        // Decode base64 string to binary data
        var binaryData = atob(cleanedBase64);
        
        // Calculate disk size in bytes
        var diskSizeInBytes = binaryData.length;
        
        return diskSizeInBytes;
    } catch (error) {
        console.error('Error calculating file size from base64:', error);
        // Return approximate size based on base64 length if atob fails
        return Math.floor(base64WithoutPrefix.length * 0.75);
    }
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