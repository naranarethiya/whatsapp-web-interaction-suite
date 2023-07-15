/**
 * Listen event from background.js on whatsapp tab
 * 
 * this will be only executed on whatsapp tab
 * */
let whatsappTabListenerSendResponse = {};
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    if(request.action == 'backgroundToWhatsapp') {
        console.log(" Received in whatappContent.js for backgroundToWhatsapp", request);
        document.dispatchEvent(new CustomEvent('whatsappContentToWhatsappJs', { detail: request } ));
        whatsappTabListenerSendResponse[request.uid] = sendResponse;
    }

    return true;
});