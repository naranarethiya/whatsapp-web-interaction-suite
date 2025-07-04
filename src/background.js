import { ExtensionActions } from './util/Constants.js';

/** Listen port.postMessage from content.js */
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === ExtensionActions.CONTENT_TO_BACKGROUND) {
        console.log("BG Received Message", request);
        sendWhatsappMessage(request, sendResponse);
        return true;
    }
});

/**
 * Handles the request to send a WhatsApp message.
 * It queries for the WhatsApp Web tab, prepares message data (including media if any),
 * sends the message to the content script on the WhatsApp Web tab (whatsappContent.js),
 * and manages responses and errors.
 * @param {object} msg - The message object received from content.js.
 * @param {function} sendResponse - Callback function to send a response back to content.js.
 */
async function sendWhatsappMessage(msg, sendResponse) {
    // Query for the active WhatsApp Web tab.
    // The URL 'https://web.whatsapp.com/*' could be moved to Constants.js if desired.
    const [tab] = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*'});

    if(!tab) {
        sendResponse({
            response : "Whatsapp is not runnung, please open whatsapp.",
            success: false,
        });
        return;
    }

    let messageData = {
        action: ExtensionActions.BACKGROUND_TO_WHATSAPP_TAB,
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
            messageData.internalOptions.attachment = await downloadMediaFromUrl(msg.url);
            messageData.internalOptions.caption = msg.text,
            messageData.text = '';
        }
        else if(typeof msg.media == 'object') {
            messageData.internalOptions.attachment = {
                // data: msg.media.data.replace(/^data:[a-z]+\/[a-z]+;base64,/, ''),
                data: msg.media.data,
                mimetype: msg.media.mime, 
                filename: msg.media.filename, 
                filesize: msg.media.filesize 
            }
            messageData.internalOptions.caption = msg.text,
            messageData.text = '';
        }
    
        // chrome.tabs.sendMessage can fail if the tab was closed or the content script isn't there.
        // The promise will be rejected, or response will be undefined and chrome.runtime.lastError will be set.
        const response = await chrome.tabs.sendMessage(tab.id, messageData);

        if (chrome.runtime.lastError) {
            // This case might occur if sendMessage callback-style was used,
            // but with async/await, it usually throws an error caught below.
            // Still, good to be aware of.
            console.error("Error sending message to WhatsApp tab:", chrome.runtime.lastError.message);
            sendResponse({
                response: `Error communicating with WhatsApp tab: ${chrome.runtime.lastError.message}`,
                success: false,
            });
        } else if (response === undefined) {
            // This can happen if the content script doesn't call sendResponse
            console.error("Undefined response from WhatsApp tab, possibly content script issue.");
            sendResponse({
                response: "Undefined response from WhatsApp tab. Content script might have an issue.",
                success: false,
            });
        } else {
            console.log("Response in Background: ", response);
            sendResponse(response);
        }
    } catch (error) {
        console.error("Error in sendWhatsappMessage:", error);
        let errorMessage = "Error while sending message";
        if (error.message) {
            errorMessage += `: ${error.message}`;
        }
        // Check if the error is due to the tab not being available
        if (error.message && (error.message.includes("No tab with id") || error.message.includes("Receiving end does not exist"))) {
            errorMessage = "Failed to send message: WhatsApp tab may have been closed or is unresponsive.";
        }

        sendResponse({
            response: errorMessage,
            success: false,
            // Avoid sending the full error object if it's not serializable or too large
            errorDetail: error.message ? error.message : "Unknown error"
        });
    }
}

async function downloadMediaFromUrl(url, options = {}) {
    const pUrl = new URL(url);
    
    async function fetchData (url, options) {
        const reqOptions = Object.assign({ headers: { accept: 'image/* video/* text/* audio/* application/pdf ' } }, options);
        const response = await fetch(url);
        const mime = response.headers.get('Content-Type');
        const size = response.headers.get('Content-Length');

        const contentDisposition = response.headers.get('Content-Disposition');
        const name = contentDisposition ? contentDisposition.match(/((?<=filename=")(.*)(?="))/) : "800x500.png";

        let data = '';
        if (response.buffer) {
            data = (await response.buffer()).toString('base64');
        } else {
            const bArray = new Uint8Array(await response.arrayBuffer());
            bArray.forEach((b) => {
                data += String.fromCharCode(b);
            });
            data = btoa(data);
        }
        
        return { 
            data: data, 
            mimetype: mime, 
            filename: name, 
            filesize: size 
        };
    }

    const res = (await fetchData(url));

    return res;
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
