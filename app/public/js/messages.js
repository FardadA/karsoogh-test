'use strict';

function renderMessages(messages) {
    const container = document.getElementById('messages-list');
    if (!container) return;

    if (messages.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-center py-6">هیچ پیامی برای نمایش وجود ندارد.</p>';
        return;
    }

    container.innerHTML = messages.map(message => `
        <div class="bg-gray-800 p-4 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-2">
                <span class="text-sm font-semibold text-blue-400">${message.channel.name}</span>
                <span class="text-xs text-gray-400">${new Date(message.createdAt).toLocaleString('fa-IR')}</span>
            </div>
            <p class="text-gray-300">${message.content}</p>
        </div>
    `).join('');
}

function fetchMessages() {
    axios.get('/api/messages')
        .then(response => {
            renderMessages(response.data);
        })
        .catch(error => {
            const container = document.getElementById('messages-list');
            if (container) {
                container.innerHTML = '<p class="text-red-400 text-center py-6">خطا در بارگذاری پیام‌ها.</p>';
            }
        });
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('messages')) {
        fetchMessages();
    }

    window.socket.on('newMessage', (message) => {
        if (document.getElementById('messages')) {
            fetchMessages(); // Re-fetch all messages to keep the list sorted
        }
    });
});
