/**
 *  this listening message from "website app" on same tab of web app
 * */
window.addEventListener("message", async (event) => {
    // Action string from webapp.js, corresponds to ExtensionActions.WEBAPP_TO_CONTENT
    if(event.data.action == 'webAppToContentjs') {
        console.log("Received event in content.js", event)
        // send message to background.js
        // Action string, corresponds to ExtensionActions.CONTENT_TO_BACKGROUND
        event.data.action = 'contentjsToBackground';
        const response = await chrome.runtime.sendMessage(event.data);

        if(!response.success) {
            triggerMessageResponse(response.response, response.success, {
                mobile: event.data.mobile,
                text: event.data.text,
                url: event.data.url ? event.data.url : '',
                base64Data: event.data.media ? event.data.media.data : '',
                mime: event.data.media ? event.data.media.mime : '',
            }, event.data.uid);
        }
        else {
            triggerMessageResponse(response.response, response.success, {
                mobile: event.data.mobile,
                text: event.data.text,
                url: event.data.url ? event.data.url : '',
                base64Data: event.data.media ? event.data.media.data : '',
                mime: event.data.media ? event.data.media.mime : '',
            }, event.data.uid);
        }
    }
});


// Removed the incorrect event listener for 'WhatsappjsResponse'.
// The response will be handled by the callback of chrome.runtime.sendMessage
// which is already in place above.

// Event name for dispatching response to the web app,
// corresponds to ExtensionEvents.CONTENT_SCRIPT_TO_WEBAPP_RESPONSE
const sendResponseEvent = 'whatsappSendResponse';
function triggerMessageResponse(response, isSuccess, message, uid = null) {
    let data = { message: message, success: isSuccess, response: response, uid: uid };
    document.dispatchEvent(new CustomEvent(sendResponseEvent,  { detail: data }));
}























let whatsappUrl = 'https://web.whatsapp.com1/';
if(window.location.href == whatsappUrl) {
    setWhatsappLoadingObserver();
}

// Function to be called when the target ID appears in the DOM
function whatsappLoaded() {
    console.log("Attached scripts");

    setTimeout(() => {
        // console.log(window.webpackChunkwhatsapp_web_client);
        // addScriptToDom('src/moduleraid.js');
        // addScriptToDom('src/util/Injected.js');
    }, 1000);
}

function setWhatsappLoadingObserver() {
    // Select the target element by its ID
    const targetId = "side";
    console.log("setting watch")

    // Create a new MutationObserver instance
    const observer = new MutationObserver((mutationsList) => {
        // Check if the target ID is now present in the DOM
        if (document.getElementById(targetId)) {
            // Disconnect the observer
            observer.disconnect();
            // Call the function to handle the event
            whatsappLoaded();
        }
    });

    // Start observing the document body for changes
    observer.observe(document.body, { childList: true, subtree: true });
}

function addScriptToDom(path) {
    console.log(path);
    var s = document.createElement('script');
    s.src = chrome.runtime.getURL(path);
    // s.onload = function() { this.remove(); };
    // see also "Dynamic values in the injected code" section in this answer
    (document.head || document.documentElement).appendChild(s);
}

function executeSnippetToDom(source) {
    var script = document.createElement("script");
    script.textContent = source;
    (document.head || document.documentElement).appendChild(script);
}

function postWidownMessage(action, data) {
    window.postMessage({
        action: action,
        ...data
    }, "*");
}
