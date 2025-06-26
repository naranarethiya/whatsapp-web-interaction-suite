
# WhatsApp Web Bridge

This Google Chrome extension facilitates the sending of WhatsApp messages via WhatsApp Web directly from your website or web application.

This extension exposes JavaScript functions that allow you to utilize them for sending both text and media messages to WhatsApp Web.

**Important:** To utilize this extension, ensure that WhatsApp Web is open and that you're logged in.

## How It works
This extension serves as a bridge between your web application and WhatsApp Web.

![How it works](https://raw.githubusercontent.com/naranarethiya/whatsapp-web-interaction-suite/main/doc/how-it-works.png "How it works")

## How to use
Install google chrome extension from https://chromewebstore.google.com/detail/agloikcgimfolhlkhfaachhialielpon

After installation, your web application can access the functions provided by this extension.

```javascript
// Send text message (Promise-based)
window.whatsappWebSuite.sendTextMessage(mobile, message)
    .then(response => {
        console.log('Message sent successfully:', response);
    })
    .catch(error => {
        console.error('Failed to send message:', error);
    });

// Send Media message (Promise-based)
window.whatsappWebSuite.sendBase64Message(mobile, base64Data, mimeType, filename, message)
    .then(response => {
        console.log('Media sent successfully:', response);
    })
    .catch(error => {
        console.error('Failed to send media:', error);
    });

// Send URL Media message (Promise-based)
window.whatsappWebSuite.sendUrlMediaMessage(mobile, url, message)
    .then(response => {
        console.log('URL media sent successfully:', response);
    })
    .catch(error => {
        console.error('Failed to send URL media:', error);
    });
```

When sending a message, ensure the mobile number includes the country code, without any space or special characters. For instance, in India, the country code is 91, so a number might appear as **918879331633**.

You can include either emojis or plain text in your message.

To send an image or video, utilize the `sendBase64Message` function. You must provide the base64-encoded file data, MIME type, and the filename you want displayed on the WhatsApp screen.

## Modern Promise-based API (Recommended)

All functions now return promises for better async handling:

```javascript
// Using async/await (modern approach)
try {
    const response = await window.whatsappWebSuite.sendTextMessage(mobile, message);
    console.log('Success:', response);
} catch (error) {
    console.error('Error:', error);
}
```

## Legacy Event-based API (Still Supported)

For backward compatibility, you can still use the event-based approach:

```javascript
// Send message (legacy way)
window.whatsappWebSuite.sendTextMessage(mobile, message);

// Listen for response (legacy way)
document.addEventListener('whatsappSendResponse', function(e) {
	if(e.detail.success) {
		// handle success 
	}
	else {
		// handle fail
	}
});
```

**Note:** Both APIs work simultaneously - existing code will continue to work without changes.

### Notes
- This extension sends messages via WhatsApp Web, so ensure that WhatsApp Web is open in one of your browser tabs.
- Please note that this extension has not been tested for bulk messaging and may not be suitable for such use cases.


### Credit
This extenstion using [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) library behind the scenes to interact with the WhatsApp Web API.