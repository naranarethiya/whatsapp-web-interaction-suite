/** Listen port.postMessage from content.js */
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'contentjsToBackground') {
        console.log("BG Received Message", request);
        sendWhatsappMessage(request, sendResponse);
        return true;
    }
});

/** trigger event on whatsapp tab */
async function sendWhatsappMessage(msg, sendResponse) {
    const [tab] = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*'});

    if(!tab) {
        sendResponse({
            response : "Whatsapp is not runnung, please open whatsapp.",
            success: false,
        });
        return;
    }

    let messageData = {
        action: 'backgroundToWhatsapp',
        text: msg.text,
        receiver: msg.mobile,
        internalOptions: {},
        uid: msg.uid || generateUniqueId(),
    };

    try {
        if(msg.url && isURL(msg.url)) {
            messageData.internalOptions = {
                linkPreview: true,
            };
            messageData.internalOptions.media = await downloadMediaFromUrl(msg.url);
            messageData.internalOptions.caption = msg.text,
            messageData.text = '';
        }
        else if(typeof msg.media == 'object') {
            messageData.internalOptions.media = {
                // data: msg.media.data.replace(/^data:[a-z]+\/[a-z]+;base64,/, ''),
                data: msg.media.data,
                mimetype: msg.media.mime, 
                filename: msg.media.filename, 
                filesize: msg.media.filesize 
            }
            messageData.internalOptions.caption = msg.text,
            messageData.text = '';
        }
    
        const response = await chrome.tabs.sendMessage(tab.id, messageData);
        console.log("Response in Background: ", response);
    
        sendResponse(response);   
    } catch (error) {
        console.log(error);
        sendResponse({
            response : "Error while sending message",
            success: false,
            error: error,
        });
    }
}

async function downloadMediaFromUrl(url, options = {}) {
    const pUrl = new URL(url);
    
    async function fetchData(url, options) {
        const reqOptions = Object.assign({ headers: { accept: 'image/* video/* text/* audio/* application/pdf ' } }, options);
        const response = await fetch(url, reqOptions);
        const mime = response.headers.get('Content-Type');
        const size = response.headers.get('Content-Length');

        const contentDisposition = response.headers.get('Content-Disposition');
        const name = contentDisposition ? contentDisposition.match(/((?<=filename=")(.*)(?="))/) : "800x500.png";

        // Optimized binary to base64 conversion
        const arrayBuffer = await response.arrayBuffer();
        const data = arrayBufferToBase64Fast(arrayBuffer);
        
        return { 
            data: data, 
            mimetype: mime, 
            filename: name, 
            filesize: size || arrayBuffer.byteLength
        };
    }

    const res = await fetchData(url);
    return res;
}

// Optimized ArrayBuffer to Base64 conversion using chunk processing
// This is significantly faster than character-by-character string concatenation
function arrayBufferToBase64Fast(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    const chunkSize = 32768; // 32KB chunks - optimal for btoa
    let binary = '';
    
    // Process in chunks to avoid call stack issues and improve performance
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
        binary += String.fromCharCode.apply(null, chunk);
    }
    
    return btoa(binary);
}


function isBlob(data) {
    return data instanceof Blob;
}
  
// Check if the data contains Base64 data
function isBase64(data) {
    // Regular expression to match Base64 pattern
    const base64Regex = /^data:(.+\/.+);base64,(.*)$/;

    return typeof data === 'string' && base64Regex.test(data);
}

function isURL(str) {
    try {
        new URL(str);
        return true;
    } catch (error) {
        return false;
    }
}

function generateUniqueId() {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substr(2, 5);
    return timestamp + randomStr;
}
