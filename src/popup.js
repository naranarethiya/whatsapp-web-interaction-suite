document.getElementById('sendButton').addEventListener('click', async function() {
    let mobile = document.getElementById('mobile').value;
    let text = document.getElementById('text').value;

    const response = await chrome.runtime.sendMessage({
        action: 'contentjsToBackground',
        text: text,
        mobile: mobile,
    });

    if(response.success) {
        alert("Message sent.");
    }
    else {
        alert("There is some problem while sending message to WhatsApp.");
    }
});