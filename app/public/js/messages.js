'use strict';

async function loadMessages() {
    const container = document.getElementById('messages-list');
    if (!container) return;

    setLoadingState(true);

    try {
        const response = await axios.get('/api/messages');
        const messages = response.data;

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
    } catch (error) {
        container.innerHTML = '<p class="text-red-400 text-center py-6">خطا در بارگذاری پیام‌ها.</p>';
    } finally {
        setLoadingState(false);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const btnRefresh = document.getElementById('btn-refresh');

    document.querySelectorAll('.menu-item[data-section="messages"]').forEach(item => {
        item.addEventListener('click', loadMessages);
    });

    if (btnRefresh) {
        btnRefresh.addEventListener('click', () => {
            if (document.querySelector('.content-section.active')?.id === 'messages') {
                loadMessages();
            }
        });
    }

    window.socket.on('newMessage', (message) => {
        if (document.querySelector('.content-section.active')?.id === 'messages') {
            loadMessages();
        }
    });

    if (document.querySelector('.content-section.active')?.id === 'messages') {
        loadMessages();
    }
});
