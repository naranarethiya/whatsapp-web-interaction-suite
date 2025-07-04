/**
/**
 * This script runs as a content script on the WhatsApp Web page (web.whatsapp.com).
 * It acts as a bridge between the background script and the MAIN world script (util/whatsapp.js)
 * which interacts directly with the WhatsApp Web JavaScript context.
 */

// Stores sendResponse callbacks from chrome.runtime.onMessage, keyed by a unique ID (uid).
// This allows asynchronous responses back to the background script.
let whatsappTabListenerSendResponse = {};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Action string, corresponds to ExtensionActions.BACKGROUND_TO_WHATSAPP_TAB
    // This message comes from the background script with a request to send a WhatsApp message.
    if(request.action == 'backgroundToWhatsapp') {
        console.log("Received in whatsappContent.js from background script:", request);

        // Dispatch an event to the MAIN world script (util/whatsapp.js) on the WhatsApp Web page.
        // This event carries the message details.
        // Event name corresponds to ExtensionEvents.CONTENT_SCRIPT_TO_WHATSAPP_MAIN_WORLD.
        document.dispatchEvent(new CustomEvent('whatsappContentToWhatsappJs', { detail: request }));

        // Store the sendResponse function to be called when util/whatsapp.js completes its task
        // and sends back a response event. The UID is used to correlate requests with responses.
        whatsappTabListenerSendResponse[request.uid] = sendResponse;

        // Indicate that sendResponse will be called asynchronously. This is crucial for chrome.runtime.onMessage
        // when the response is not sent immediately within this listener function.
        return true;
    }
    // Return false for messages not handled by this listener, or if sendResponse is used synchronously.
    return false;
});

// Listen for the response event from util/whatsapp.js (MAIN world script).
// This event signifies that the message sending attempt has completed (either success or failure).
// Event name corresponds to ExtensionEvents.WHATSAPP_MAIN_WORLD_TO_CONTENT_SCRIPT_RESPONSE.
const responseEventFromWhatsappJs = 'WhatsappjsResponse';
document.addEventListener(responseEventFromWhatsappJs, (event) => {
    const { uid, success, response } = event.detail;
    console.log(`whatsappContent.js received '${responseEventFromWhatsappJs}' from MAIN world:`, event.detail);

    const sendResponseCallback = whatsappTabListenerSendResponse[uid];
    if (sendResponseCallback) {
        // Send the response back to the background script.
        sendResponseCallback({ success, response, uid });
        // Clean up the stored callback to prevent memory leaks and re-use of old callbacks.
        delete whatsappTabListenerSendResponse[uid];
    } else {
        // This should ideally not happen if UIDs are managed correctly.
        console.warn(`No sendResponse callback found for UID: ${uid} in whatsappContent.js. Response from MAIN world was:`, event.detail);
    }
});