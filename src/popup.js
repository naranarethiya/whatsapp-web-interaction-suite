// Global variables
let selectedFile = null;

// Tab switching functionality
function switchTab(tabName) {
    // Hide all tab contents
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => content.classList.remove('active'));
    
    // Remove active class from all tabs
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => tab.classList.remove('active'));
    
    // Show selected tab content
    document.getElementById(tabName + '-tab').classList.add('active');
    
    // Add active class to clicked tab
    const clickedTab = document.querySelector(`[data-tab="${tabName}"]`);
    if (clickedTab) {
        clickedTab.classList.add('active');
    }
}

// Utility functions
function showStatus(elementId, message, type = 'info') {
    const statusElement = document.getElementById(elementId);
    statusElement.textContent = message;
    statusElement.className = `status ${type}`;
    statusElement.style.display = 'block';
    
    // Auto hide after 5 seconds for success messages
    if (type === 'success') {
        setTimeout(() => {
            statusElement.style.display = 'none';
        }, 5000);
    }
}

function validateMobile(mobile) {
    const pattern = /^\d{7,15}$/;
    return pattern.test(mobile.replace(/\s+/g, ''));
}

function setButtonLoading(buttonId, isLoading, originalText) {
    const button = document.getElementById(buttonId);
    if (isLoading) {
        button.disabled = true;
        button.innerHTML = '<span class="icon">⏳</span>Sending...';
    } else {
        button.disabled = false;
        button.innerHTML = originalText;
    }
}

// Text message functionality
async function sendTextMessage() {
    const mobile = document.getElementById('textMobile').value.trim();
    const message = document.getElementById('textMessage').value.trim();
    
    // Validation
    if (!mobile) {
        showStatus('textStatus', 'Please enter a mobile number', 'error');
        return;
    }
    
    if (!validateMobile(mobile)) {
        showStatus('textStatus', 'Please enter a valid mobile number (7-15 digits)', 'error');
        return;
    }
    
    if (!message) {
        showStatus('textStatus', 'Please enter a message', 'error');
        return;
    }
    
    // Send message
    setButtonLoading('textBtn', true, '<span class="icon">🚀</span>Send Text Message');
    showStatus('textStatus', 'Sending message...', 'info');
    
    try {
        const response = await chrome.runtime.sendMessage({
            action: 'contentjsToBackground',
            text: message,
            mobile: mobile,
        });
        
        if (response.success) {
            showStatus('textStatus', '✅ Message sent successfully!', 'success');
            // Clear form
            document.getElementById('textMessage').value = '';
        } else {
            showStatus('textStatus', `❌ Failed to send: ${response.response || 'Unknown error'}`, 'error');
        }
    } catch (error) {
        showStatus('textStatus', `❌ Error: ${error.message}`, 'error');
    } finally {
        setButtonLoading('textBtn', false, '<span class="icon">🚀</span>Send Text Message');
    }
}

// URL media functionality
function previewUrl() {
    const url = document.getElementById('mediaUrl').value.trim();
    const previewDiv = document.getElementById('urlPreview');
    
    if (!url) {
        previewDiv.style.display = 'none';
        return;
    }
    
    // Basic URL validation
    try {
        new URL(url);
    } catch (e) {
        previewDiv.innerHTML = '<span style="color: #c62828;">Invalid URL format</span>';
        previewDiv.style.display = 'block';
        return;
    }
    
    // Show preview based on file type
    const extension = url.split('.').pop().toLowerCase();
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
    const videoExtensions = ['mp4', 'webm', 'ogg', 'mov', 'avi'];
    
    if (imageExtensions.includes(extension)) {
        previewDiv.innerHTML = `
            <div style="font-size: 12px; margin-bottom: 8px;">📷 Image Preview:</div>
            <img src="${url}" alt="Preview" onerror="this.style.display='none'; this.nextSibling.style.display='block';">
            <div style="display: none; color: #c62828;">Failed to load image</div>
        `;
        previewDiv.style.display = 'block';
    } else if (videoExtensions.includes(extension)) {
        previewDiv.innerHTML = `
            <div style="font-size: 12px; margin-bottom: 8px;">🎥 Video Preview:</div>
            <video controls style="max-width: 100%; max-height: 150px;">
                <source src="${url}" type="video/${extension}">
                Your browser does not support the video tag.
            </video>
        `;
        previewDiv.style.display = 'block';
    } else {
        previewDiv.innerHTML = `
            <div style="font-size: 12px;">📄 File: ${url.split('/').pop()}</div>
            <div style="font-size: 11px; color: #666; margin-top: 4px;">Type: ${extension.toUpperCase()}</div>
        `;
        previewDiv.style.display = 'block';
    }
}

async function sendUrlMessage() {
    const mobile = document.getElementById('urlMobile').value.trim();
    const message = document.getElementById('urlMessage').value.trim();
    const url = document.getElementById('mediaUrl').value.trim();
    
    // Validation
    if (!mobile) {
        showStatus('urlStatus', 'Please enter a mobile number', 'error');
        return;
    }
    
    if (!validateMobile(mobile)) {
        showStatus('urlStatus', 'Please enter a valid mobile number (7-15 digits)', 'error');
        return;
    }
    
    if (!url) {
        showStatus('urlStatus', 'Please enter a media URL', 'error');
        return;
    }
    
    try {
        new URL(url);
    } catch (e) {
        showStatus('urlStatus', 'Please enter a valid URL', 'error');
        return;
    }
    
    // Send message
    setButtonLoading('urlBtn', true, '<span class="icon">🚀</span>Send URL Media');
    showStatus('urlStatus', 'Sending media message...', 'info');
    
    try {
        const response = await chrome.runtime.sendMessage({
            action: 'contentjsToBackground',
            mobile: mobile,
            text: message,
            url: url
        });

        console.log("Response in Popup.js", response);

        
        if (response.success) {
            showStatus('urlStatus', '✅ Media message sent successfully!', 'success');
            // Clear form
            document.getElementById('urlMessage').value = '';
            document.getElementById('mediaUrl').value = '';
            document.getElementById('urlPreview').style.display = 'none';
        } else {
            showStatus('urlStatus', `❌ Failed to send: ${response.response || 'Unknown error'}`, 'error');
        }
    } catch (error) {
        showStatus('urlStatus', `❌ Error: ${error.message}`, 'error');
    } finally {
        setButtonLoading('urlBtn', false, '<span class="icon">🚀</span>Send URL Media');
    }
}

// File upload functionality
function handleFileSelect() {
    const fileInput = document.getElementById('fileInput');
    const fileInfo = document.getElementById('fileInfo');
    const fileBtn = document.getElementById('fileBtn');
    
    if (fileInput.files.length === 0) {
        fileInfo.style.display = 'none';
        fileBtn.disabled = true;
        selectedFile = null;
        return;
    }
    
    selectedFile = fileInput.files[0];
    const fileSize = (selectedFile.size / 1024 / 1024).toFixed(2); // MB
    const fileType = selectedFile.type || 'Unknown';
    
    // Show file info
    fileInfo.innerHTML = `
        <div style="font-weight: 500;">📄 ${selectedFile.name}</div>
        <div style="margin-top: 4px;">
            <span>Size: ${fileSize} MB</span> | 
            <span>Type: ${fileType}</span>
        </div>
    `;
    fileInfo.style.display = 'block';
    fileBtn.disabled = false;
    
    // Check file size (limit to 16MB for WhatsApp)
    if (selectedFile.size > 16 * 1024 * 1024) {
        showStatus('fileStatus', '⚠️ File size exceeds 16MB limit. WhatsApp may not accept this file.', 'error');
    } else {
        showStatus('fileStatus', '✅ File ready to send', 'success');
    }
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            // Extract base64 data without the data URL prefix
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = error => reject(error);
    });
}

function getMimeType(file) {
    if (file.type) {
        return file.type;
    }
    
    // Fallback based on file extension
    const extension = file.name.split('.').pop().toLowerCase();
    const mimeTypes = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'mp4': 'video/mp4',
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav'
    };
    
    return mimeTypes[extension] || 'application/octet-stream';
}

async function sendFileMessage() {
    const mobile = document.getElementById('fileMobile').value.trim();
    const message = document.getElementById('fileMessage').value.trim();
    
    // Validation
    if (!mobile) {
        showStatus('fileStatus', 'Please enter a mobile number', 'error');
        return;
    }
    
    if (!validateMobile(mobile)) {
        showStatus('fileStatus', 'Please enter a valid mobile number (7-15 digits)', 'error');
        return;
    }
    
    if (!selectedFile) {
        showStatus('fileStatus', 'Please select a file', 'error');
        return;
    }
    
    // Send message
    setButtonLoading('fileBtn', true, '<span class="icon">🚀</span>Send File');
    showStatus('fileStatus', 'Converting file to base64...', 'info');
    
    try {
        // Convert file to base64
        const base64Data = await fileToBase64(selectedFile);
        const mimeType = getMimeType(selectedFile);
        
        showStatus('fileStatus', 'Sending file message...', 'info');
        
        const response = await chrome.runtime.sendMessage({
            action: 'contentjsToBackground',
            mobile: mobile,
            text: message,
            media: {
                mime: mimeType,
                data: base64Data,
                filename: selectedFile.name,
                filesize: getDiskSizeFromBase64(base64Data)
            },
        });
        
        if (response.success) {
            showStatus('fileStatus', '✅ File sent successfully!', 'success');
            // Clear form
            document.getElementById('fileMessage').value = '';
            document.getElementById('fileInput').value = '';
            document.getElementById('fileInfo').style.display = 'none';
            document.getElementById('fileBtn').disabled = true;
            selectedFile = null;
        } else {
            showStatus('fileStatus', `❌ Failed to send: ${response.response || 'Unknown error'}`, 'error');
        }
    } catch (error) {
        showStatus('fileStatus', `❌ Error: ${error.message}`, 'error');
    } finally {
        setButtonLoading('fileBtn', false, '<span class="icon">🚀</span>Send File');
    }
}

// Initialize popup
document.addEventListener('DOMContentLoaded', function() {
    // Set default values for testing
    document.getElementById('textMobile').value = '';
    document.getElementById('urlMobile').value = '';
    document.getElementById('fileMobile').value = '';
    
    // Add event listeners for tabs
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            switchTab(tabName);
        });
    });
    
    // Add event listeners for buttons
    document.getElementById('textBtn').addEventListener('click', sendTextMessage);
    document.getElementById('urlBtn').addEventListener('click', sendUrlMessage);
    document.getElementById('fileBtn').addEventListener('click', sendFileMessage);
    
    // Add event listener for URL input
    document.getElementById('mediaUrl').addEventListener('input', previewUrl);
    document.getElementById('mediaUrl').addEventListener('change', previewUrl);
    
    // Add event listener for file input
    document.getElementById('fileInput').addEventListener('change', handleFileSelect);
    
    // Add drag and drop functionality for file input
    const fileInput = document.querySelector('.file-input');
    
    fileInput.addEventListener('dragover', (e) => {
        e.preventDefault();
        fileInput.style.borderColor = '#25D366';
        fileInput.style.background = '#f0fff0';
    });
    
    fileInput.addEventListener('dragleave', (e) => {
        e.preventDefault();
        fileInput.style.borderColor = '#ddd';
        fileInput.style.background = '#fafafa';
    });
    
    fileInput.addEventListener('drop', (e) => {
        e.preventDefault();
        fileInput.style.borderColor = '#ddd';
        fileInput.style.background = '#fafafa';
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            document.getElementById('fileInput').files = files;
            handleFileSelect();
        }
    });
});

function getDiskSizeFromBase64(base64Data) {
    // Remove metadata prefix (e.g., 'data:image/png;base64,')
    // Use more flexible regex to handle various MIME types
    var base64WithoutPrefix = base64Data.replace(/^data:[^;]+;base64,/, '');
  
    try {
        // Clean the base64 data before processing
        var cleanedBase64 = cleanBase64Data(base64WithoutPrefix);
        
        // Decode base64 string to binary data
        var binaryData = atob(cleanedBase64);
        
        // Calculate disk size in bytes
        var diskSizeInBytes = binaryData.length;
        
        return diskSizeInBytes;
    } catch (error) {
        console.error('Error calculating file size from base64:', error);
        // Return approximate size based on base64 length if atob fails
        return Math.floor(base64WithoutPrefix.length * 0.75);
    }
}