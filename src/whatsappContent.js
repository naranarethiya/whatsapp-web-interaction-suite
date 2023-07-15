/**
 * Listen event from background.js on whatsapp tab
 * 
 * this will be only executed on whatsapp tab
 * */
let whatsappTabListenerSendResponse = {};
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    if(request.action == 'sendWhatsappMessage') {
        console.log(" Received in content.js for sendWhatsappMessage", request);
        document.dispatchEvent(new CustomEvent(sendWhatsappEvent, { detail: request } ));
        whatsappTabListenerSendResponse[request.uid] = sendResponse;
    }

    return true;
});


/** received event from content.js to send final message */
// const sendWhatsappEvent = 'triggerWhatsappSend';
document.addEventListener(sendWhatsappEvent, (e) => {
    window.WWebJS.sendWhatsappMessage(e.detail.receiver, e.detail.text, e.detail.internalOptions, false, e.returnMessage);
});
