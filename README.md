
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
// Send text message
window.whatsappWebSuite.sendTextMessage(
	mobile, 
	message
);

// Send Media message
window.whatsappWebSuite.sendBase64Message(
	mobile, 
	base64Data, 
	mimeType, 
	filename, 
	message
)
```

When sending a message, ensure the mobile number includes the country code, without any space or special characters. For instance, in India, the country code is 91, so a number might appear as **918879331633**.

You can include either emojis or plain text in your message.

To send an image or video, utilize the `sendBase64Message` function. You must provide the base64-encoded file data, MIME type, and the filename you want displayed on the WhatsApp screen.

Listen for the `whatsappSendResponse` event to check the status of the message you've sent.

```javascript
document.addEventListener('whatsappSendResponse', function(e, data) {
	if(e.detail.success) {
		// handle success 
	}
	else {
		// handle fail
	}
})
```
### Notes
- This extension sends messages via WhatsApp Web, so ensure that WhatsApp Web is open in one of your browser tabs.
- Please note that this extension has not been tested for bulk messaging and may not be suitable for such use cases.


### Credit
This extenstion using [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) library behind the scenes to interact with the WhatsApp Web API.