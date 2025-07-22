document.addEventListener('DOMContentLoaded', () => {
    const puzzleRoomSection = document.getElementById('puzzle-room');
    const puzzleRoomContent = document.getElementById('puzzle-room-content');
    let currentRoomData = null;

    const uiElements = {
        headerMenu: document.getElementById('open-mobile-menu'),
        headerNotifications: document.getElementById('btn-notifications'),
        headerLogout: document.querySelector('a[href="/logout"]'),
        desktopMenu: document.getElementById('desktop-menu'),
    };

    const toggleMainUI = (show) => {
        const displayStyle = show ? '' : 'none';
        Object.values(uiElements).forEach(el => {
            if (el) el.style.display = displayStyle;
        });
    };

    const loadPuzzleRoomFromURL = async () => {
        const path = window.location.pathname;
        const match = path.match(/^\/dashboard\/rooms\/(.+)/);
        if (match) {
            const identifier = match[1];
            toggleMainUI(false);
            if (window.showSection) {
                window.showSection('puzzle-room');
                const pageTitle = document.getElementById('page-title');
                if (pageTitle) pageTitle.textContent = 'اتاق معما';
            }
            await fetchAndRenderPuzzleRoom(identifier);
        } else {
            toggleMainUI(true);
        }
    };

    const fetchAndRenderPuzzleRoom = async (identifier) => {
        try {
            const response = await axios.get(`/api/puzzle-room/${identifier}`);
            currentRoomData = response.data;
            renderPuzzleRoom(currentRoomData.room, currentRoomData.status);
        } catch (error) {
            console.error('Error fetching puzzle room data:', error);
            const errorMessage = error.response?.data?.message || 'خطا در بارگذاری اتاق.';
            puzzleRoomContent.innerHTML = `<div class="text-center text-red-400 p-8">${errorMessage}</div>`;
        }
    };

    const renderPuzzleRoom = (room, status) => {
        puzzleRoomContent.innerHTML = '';
        switch (status.status) {
            case 'unanswered':
                puzzleRoomContent.innerHTML = createUnansweredView(room, status);
                attachUploadListener(room, status);
                attachDeleteListener(room, status);
                break;
            case 'pending_correction':
                puzzleRoomContent.innerHTML = createPendingView(room, status);
                break;
            case 'corrected':
            case 'deleted': // Both trigger prize flow
                puzzleRoomContent.innerHTML = createCompletedView(room, status);
                if(status.status === 'deleted') {
                    claimPrize(status);
                } else if (status.prizeClaimed === false) {
                    attachClaimPrizeListener(room, status);
                } else if (status.chosenPrizeRoomId) {
                    attachShowPrizeListener(room, status);
                }
                break;
            default:
                puzzleRoomContent.innerHTML = `<p>وضعیت نامشخص</p>`;
        }
    };

    const createUnansweredView = (room, status) => `
        <h2 class="text-3xl font-bold text-center mb-2">${room.name} (#${room.roomNumber})</h2>
        <p class="text-center text-gray-400 mb-6">موضوع: ${room.subject} | سطح: ${room.difficulty} | حداکثر امتیاز: ${room.maxPoints}</p>
        <div class="bg-gray-800 p-4 rounded-lg">
            <img src="${room.questionImage}" alt="تصویر معما" class="mx-auto rounded-md max-w-full h-auto shadow-lg">
        </div>
        <div class="mt-8 text-center">
            <h3 class="text-xl font-bold mb-4">ارسال پاسخ</h3>
            <form id="answer-upload-form" class="flex items-center justify-center space-x-2 space-x-reverse">
                <input type="file" name="answerFile" id="answer-file-input" class="input-field" required accept="image/*,application/pdf">
                <button type="submit" class="btn-primary">ارسال</button>
                <button type="button" id="delete-submission-btn" class="btn-secondary bg-orange-600 hover:bg-orange-700">انصراف</button>
            </form>
        </div>
    `;

    const createPendingView = (room, status) => `
        <h2 class="text-3xl font-bold text-center mb-6">${room.name} (#${room.roomNumber})</h2>
        <div class="text-center bg-gray-800 p-8 rounded-lg">
            <i class="fas fa-hourglass-half text-5xl text-yellow-400 mb-4 animate-spin"></i>
            <h3 class="text-2xl font-bold">پاسخ شما ارسال شد!</h3>
            <p class="text-gray-300 mt-2">در انتظار تصحیح توسط ادمین...</p>
            <a href="${status.answerFile}" target="_blank" class="text-blue-400 hover:underline mt-6 inline-block">مشاهده فایل ارسالی</a>
        </div>
    `;

    const createCompletedView = (room, status) => {
        const isCancelled = status.status === 'deleted';
        let mainMessage, prizeHtml = '';

        if (isCancelled) {
            mainMessage = `
                <i class="fas fa-trash-alt text-5xl text-orange-500 mb-4"></i>
                <h3 class="text-2xl font-bold">شما از این سوال انصراف دادید.</h3>
                <p class="text-gray-300 mt-2">امتیازی ثبت نشد، اما می‌توانید جایزه خود را برای ورود به اتاق بعدی انتخاب کنید.</p>`;
            prizeHtml = `<div class="mt-8 text-center border-t-2 border-gray-700 pt-6" id="prize-section"><div class="w-8 h-8 border-t-2 border-blue-500 rounded-full animate-spin mx-auto"></div><p class="mt-2">در حال آماده‌سازی جایزه...</p></div>`;
        } else { // Corrected
            mainMessage = `
                <i class="fas fa-check-circle text-5xl text-green-400 mb-4"></i>
                <h3 class="text-2xl font-bold">پاسخ شما تصحیح شد!</h3>
                <p class="text-4xl font-bold text-yellow-400 my-4">${status.score} <span class="text-lg text-gray-300">/ ${room.maxPoints}</span></p>
                <p class="text-gray-300">این امتیاز به مجموع امتیازات گروه شما اضافه شد.</p>`;
            if (status.prizeClaimed === false) {
                prizeHtml = `<div class="mt-8 text-center border-t-2 border-gray-700 pt-6" id="prize-section"><h3 class="text-xl font-bold">تبریک! شما یک جایزه دارید.</h3><div id="prize-content"><button id="claim-prize-btn" class="btn-primary mt-4">دریافت جایزه</button></div></div>`;
            } else if (status.chosenPrizeRoomId && status.chosenPrizeRoom) {
                prizeHtml = `<div class="mt-8 text-center border-t-2 border-gray-700 pt-6" id="prize-section"><h3 class="text-xl font-bold">جایزه شما دریافت شد!</h3><div id="prize-content"><p class="text-gray-300 mt-2">رمز ورود به اتاق بعدی شما آماده است.</p><button id="show-prize-btn" class="btn-secondary mt-4">مشاهده رمز اتاق مقصد</button></div></div>`;
            }
        }
        return `<h2 class="text-3xl font-bold text-center mb-6">${room.name} (#${room.roomNumber})</h2><div class="text-center bg-gray-800 p-8 rounded-lg">${mainMessage}</div>${prizeHtml}`;
    };

    const createPrizeSelectionView = (prizeOptions, status) => `
        <h3 class="text-2xl font-bold text-center mb-4">یک اتاق را به عنوان جایزه انتخاب کنید!</h3>
        <p class="text-gray-400 text-center mb-6">با انتخاب هر اتاق، رمز ورود آن برای شما نمایش داده خواهد شد.</p>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            ${prizeOptions.map(room => `<div class="bg-gray-700 p-4 rounded-lg text-center"><h4 class="text-xl font-bold">${room.name}</h4><p class="text-sm text-gray-400">${room.subject}</p><p class="my-2">سطح: <span class="font-semibold">${room.difficulty}</span></p><button class="btn-primary w-full select-prize-btn" data-room-id="${room.id}">انتخاب</button></div>`).join('')}
        </div>`;

    const createPrizeDisplayView = (prizeRoom) => `
        <h3 class="text-xl font-bold">جایزه شما دریافت شد!</h3>
        <p class="text-gray-300 mt-2">رمز ورود به اتاق <strong class="text-yellow-400">${prizeRoom.name}</strong>:</p>
        <p class="text-4xl font-mono bg-gray-900 p-4 rounded-md my-4 tracking-widest">${prizeRoom.password}</p>
        <p class="text-xs text-gray-400 mt-4">این رمز را کپی کرده و در ماجراجویی بزرگ‌تر خود استفاده کنید.</p>`;

    const attachUploadListener = (room, status) => {
        const form = document.getElementById('answer-upload-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fileInput = document.getElementById('answer-file-input');
            if (!fileInput.files.length) {
                window.sendNotification('error', 'لطفا یک فایل را انتخاب کنید.');
                return;
            }
            const formData = new FormData();
            formData.append('answerFile', fileInput.files[0]);
            window.setLoadingState(true);
            try {
                await axios.post(`/api/puzzle-room/${room.id}/submit-answer`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            } catch (error) {
                window.sendNotification('error', error.response?.data?.message || 'خطا در آپلود فایل.');
            } finally {
                window.setLoadingState(false);
            }
        });
    };

    const attachDeleteListener = (room, status) => {
        const btn = document.getElementById('delete-submission-btn');
        btn.addEventListener('click', () => {
            window.sendConfirmationNotification('confirm', 'آیا از انصراف از این سوال مطمئن هستید؟', async (confirmed) => {
                if (confirmed) {
                    window.setLoadingState(true);
                    try {
                        await axios.post(`/api/puzzle-room/${status.id}/delete`);
                    } catch (error) {
                        window.sendNotification('error', error.response?.data?.message || 'خطا در حذف سوال.');
                    } finally {
                        window.setLoadingState(false);
                    }
                }
            });
        });
    };

    const claimPrize = async (status) => {
        const prizeSection = document.getElementById('prize-section');
        if (!prizeSection) return;
        try {
            const response = await axios.post(`/api/puzzle-room/${status.id}/claim-prize`);
            if (response.data.prizeOptions && response.data.prizeOptions.length > 0) {
                prizeSection.innerHTML = createPrizeSelectionView(response.data.prizeOptions, status);
                attachSelectPrizeListeners(status);
            } else {
                prizeSection.innerHTML = `<p class="text-center text-yellow-400 mt-4">متاسفانه در حال حاضر جایزه‌ای برای شما وجود ندارد.</p>`;
            }
        } catch (error) {
            window.sendNotification('error', error.response?.data?.message || 'خطا در درخواست جایزه.');
        }
    };

    const attachClaimPrizeListener = (room, status) => {
        const btn = document.getElementById('claim-prize-btn');
        if (btn) btn.addEventListener('click', () => claimPrize(status));
    };

    const attachSelectPrizeListeners = (originalStatus) => {
        document.querySelectorAll('.select-prize-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const chosenRoomId = e.target.dataset.roomId;
                window.setLoadingState(true);
                try {
                    const response = await axios.post(`/api/puzzle-room/${originalStatus.id}/select-prize`, { chosenRoomId });
                    const prizeSection = document.getElementById('prize-section');
                    if (prizeSection) prizeSection.innerHTML = createPrizeDisplayView(response.data.chosenPrizeRoom);
                    window.sendNotification('success', response.data.message);
                } catch (error) {
                    window.sendNotification('error', error.response?.data?.message || 'خطا در انتخاب جایزه.');
                } finally {
                    window.setLoadingState(false);
                }
            });
        });
    };

    const attachShowPrizeListener = (room, status) => {
        const btn = document.getElementById('show-prize-btn');
        if(btn) btn.addEventListener('click', () => {
            const prizeContent = document.getElementById('prize-content');
            if(prizeContent) prizeContent.innerHTML = createPrizeDisplayView(status.chosenPrizeRoom);
        });
    };

    const handleRefresh = async () => {
        const path = window.location.pathname;
        const match = path.match(/^\/dashboard\/rooms\/(.+)/);
        if (match) {
            window.setLoadingState(true);
            await fetchAndRenderPuzzleRoom(match[1]);
            window.setLoadingState(false);
        }
    };
    document.getElementById('btn-refresh').addEventListener('click', handleRefresh);

    window.socket.on('submission_received', (data) => {
        if (currentRoomData && currentRoomData.room.id === data.roomId) {
             fetchAndRenderPuzzleRoom(currentRoomData.room.uniqueIdentifier);
        }
    });
    window.socket.on('submission_corrected', (data) => {
        if (currentRoomData && currentRoomData.status.id === data.groupRoomStatusId) {
             window.sendNotification('success', 'پاسخ شما تصحیح شد!');
             fetchAndRenderPuzzleRoom(currentRoomData.room.uniqueIdentifier);
        }
    });
    window.socket.on('submission_deleted', (data) => {
        if (currentRoomData && currentRoomData.status.id === data.groupRoomStatusId) {
            window.sendNotification('info', 'از سوال انصراف دادید. در حال آماده سازی جایزه...');
            fetchAndRenderPuzzleRoom(currentRoomData.room.uniqueIdentifier);
        }
    });

    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', () => {
            setTimeout(() => {
                if (!window.location.pathname.startsWith('/dashboard/rooms/')) {
                    toggleMainUI(true);
                }
            }, 50);
        });
    });

    loadPuzzleRoomFromURL();
});
