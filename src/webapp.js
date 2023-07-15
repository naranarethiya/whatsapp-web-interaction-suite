const messageAction = 'webAppToContentjs';
const sendResponseEvent = 'whatsappSendResponse';
window.whatsappWebSuite = {};

window.whatsappWebSuite.sendTextMessage = function(mobile, text) {

    let message = {
        'mobile': mobile,
        'text': text,
    };

    if(!isValidMobile(mobile)) {
        return triggerMessageResponse("Mobile number is not valid", false, message);
    }

    if(isEmptyString(text)) {
        return triggerMessageResponse("Text is required.", false, message);
    }

    window.postMessage({
        action: messageAction,
        mobile: mobile,
        text: text,
    }, "*");
}


window.whatsappWebSuite.sendUrlMediaMessage = function(mobile, url, text) {

    let message = {
        'mobile': mobile,
        'text': text,
        'url': url,
    };

    if(!isValidMobile(mobile)) {
        return triggerMessageResponse( "Mobile number is not valid", false, message);
    }

    if(!isURL(url)) {
        return triggerMessageResponse("URL is not valid URL.", false, message);
    }

    window.postMessage({
        action: messageAction,
        mobile: mobile,
        text: text,
        url: url,
    }, "*");
}

window.whatsappWebSuite.sendBase64Message = function(mobile, base64Data, mime, filename, text) {

    let message = {
        'mobile': mobile,
        'text': text,
        'base64Data': base64Data,
        'mime': mime,
    };

    if(!isValidMobile(mobile)) {
        return triggerMessageResponse( "Mobile number is not valid", false, message);
    }

    if(!isBase64(base64Data)) {
        return triggerMessageResponse("Invalid base64 Data", false, message);
    }

    if(isEmptyString(mime)) {
        return triggerMessageResponse("mime is required.", false, message);
    }

    if(isEmptyString(filename)) {
        return triggerMessageResponse("filename is required.", false, message);
    }

    window.postMessage({
        action: messageAction,
        mobile: mobile,
        text: text,
        media: {
            mime: mime,
            data: base64Data,
            filename: filename,
            filesize: getDiskSizeFromBase64(base64Data)
        },
    }, "*");

    
}


function triggerMessageResponse(response, isSuccess, message) {
    let data = { message: message, success: isSuccess, response: response };
    document.dispatchEvent(new CustomEvent(sendResponseEvent,  { detail: data }));
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

function getDiskSizeFromBase64(base64Data) {
    // Remove metadata prefix (e.g., 'data:image/png;base64,')
    var base64WithoutPrefix = base64Data.replace(/^data:[a-z]+\/[a-z]+;base64,/, '');
  
    // Decode base64 string to binary data
    var binaryData = atob(base64WithoutPrefix);
  
    // Calculate disk size in bytes
    var diskSizeInBytes = binaryData.length;
  
    return diskSizeInBytes;
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