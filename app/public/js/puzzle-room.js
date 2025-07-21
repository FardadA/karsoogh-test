document.addEventListener('DOMContentLoaded', () => {
    const puzzleRoomSection = document.getElementById('puzzle-room');
    const puzzleRoomContent = document.getElementById('puzzle-room-content');
    let currentRoomData = null; // To store room data globally within this script

    // --- Core Logic ---

    // Function to check the URL and load the puzzle room if necessary
    const loadPuzzleRoomFromURL = async () => {
        const path = window.location.pathname;
        const match = path.match(/^\/dashboard\/rooms\/(.+)/);
        if (match) {
            const identifier = match[1];
            // Use the globally exposed function from tabs.js to handle section switching
            if (window.showSection) {
                window.showSection('puzzle-room');
                // Manually update title as this section is not in the menu
                const pageTitle = document.getElementById('page-title');
                if(pageTitle) pageTitle.textContent = 'اتاق معMA';
            } else {
                // Fallback for safety
                document.querySelectorAll('main .content-section').forEach(sec => sec.classList.remove('active'));
                puzzleRoomSection.classList.add('active');
            }
            await fetchAndRenderPuzzleRoom(identifier);
        }
    };

    // Function to fetch data from the API and trigger rendering
    const fetchAndRenderPuzzleRoom = async (identifier) => {
        try {
            const response = await axios.get(`/api/puzzle-room/${identifier}`);
            currentRoomData = response.data;
            renderPuzzleRoom(currentRoomData.room, currentRoomData.status);
        } catch (error) {
            console.error('Error fetching puzzle room data:', error);
            const errorMessage = error.response?.data?.message || 'خطا در بارگذاری اتاق. لطفاً صفحه را رفرش کنید.';
            puzzleRoomContent.innerHTML = `<div class="text-center text-red-400 p-8">${errorMessage}</div>`;
        }
    };

    // --- Rendering Logic ---

    // Main render function that decides which view to show based on status
    const renderPuzzleRoom = (room, status) => {
        puzzleRoomContent.innerHTML = ''; // Clear previous content
        switch (status.status) {
            case 'unanswered':
                puzzleRoomContent.innerHTML = createUnansweredView(room, status);
                attachUploadListener(room, status);
                break;
            case 'pending_correction':
                puzzleRoomContent.innerHTML = createPendingView(room, status);
                break;
            case 'corrected':
                puzzleRoomContent.innerHTML = createCorrectedView(room, status);
                if (!status.prizeClaimed) {
                    attachClaimPrizeListener(room, status);
                } else if(status.chosenPrizeRoomId) {
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
            <form id="answer-upload-form">
                <input type="file" name="answerFile" id="answer-file-input" class="input-field mb-4" required accept="image/*,application/pdf">
                <button type="submit" class="btn-primary w-full md:w-auto">ارسال فایل</button>
            </form>
        </div>
    `;

    const createPendingView = (room, status) => `
        <h2 class="text-3xl font-bold text-center mb-6">${room.name} (#${room.roomNumber})</h2>
        <div class="text-center bg-gray-800 p-8 rounded-lg">
            <i class="fas fa-hourglass-half text-5xl text-yellow-400 mb-4 animate-spin"></i>
            <h3 class="text-2xl font-bold">پاسخ شما ارسال شد!</h3>
            <p class="text-gray-300 mt-2">پاسخ شما در انتظار تصحیح توسط ادمین است. به محض تصحیح، نتیجه به شما اطلاع داده خواهد شد.</p>
            <a href="${status.answerFile}" target="_blank" class="text-blue-400 hover:underline mt-6 inline-block">مشاهده فایل ارسالی</a>
        </div>
    `;

    const createCorrectedView = (room, status) => {
        let prizeSection = '';
        if (status.prizeClaimed === false) {
            prizeSection = `
                <div class="mt-8 text-center border-t-2 border-gray-700 pt-6">
                    <h3 class="text-xl font-bold">تبریک! شما یک جایزه دارید.</h3>
                    <button id="claim-prize-btn" class="btn-primary mt-4">دریافت جایزه</button>
                </div>
            `;
        } else if (status.chosenPrizeRoomId && status.chosenPrizeRoom) {
             prizeSection = `
                <div class="mt-8 text-center border-t-2 border-gray-700 pt-6">
                    <h3 class="text-xl font-bold">جایزه شما دریافت شد!</h3>
                    <p class="text-gray-300 mt-2">رمز ورود به اتاق بعدی شما آماده است.</p>
                    <button id="show-prize-btn" class="btn-secondary mt-4">مشاهده رمز اتاق مقصد</button>
                </div>
            `;
        } else {
             prizeSection = `<div class="mt-8 text-center border-t-2 border-gray-700 pt-6"><p>جایزه شما قبلا دریافت شده است.</p></div>`;
        }

        return `
            <h2 class="text-3xl font-bold text-center mb-6">${room.name} (#${room.roomNumber})</h2>
            <div class="text-center bg-gray-800 p-8 rounded-lg">
                <i class="fas fa-check-circle text-5xl text-green-400 mb-4"></i>
                <h3 class="text-2xl font-bold">پاسخ شما تصحیح شد!</h3>
                <p class="text-4xl font-bold text-yellow-400 my-4">${status.score} <span class="text-lg text-gray-300">/ ${room.maxPoints}</span></p>
                <p class="text-gray-300">این امتیاز به مجموع امتیازات گروه شما اضافه شد.</p>
            </div>
            <div id="prize-container">${prizeSection}</div>
        `;
    };

    const createPrizeSelectionView = (prizeOptions, status) => `
        <h3 class="text-2xl font-bold text-center mb-4">یک اتاق را به عنوان جایزه انتخاب کنید!</h3>
        <p class="text-gray-400 text-center mb-6">با انتخاب هر اتاق، رمز ورود آن برای شما نمایش داده خواهد شد.</p>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            ${prizeOptions.map(room => `
                <div class="bg-gray-700 p-4 rounded-lg text-center">
                    <h4 class="text-xl font-bold">${room.name}</h4>
                    <p class="text-sm text-gray-400">${room.subject}</p>
                    <p class="my-2">سطح: <span class="font-semibold">${room.difficulty}</span></p>
                    <button class="btn-primary w-full select-prize-btn" data-room-id="${room.id}">انتخاب این جایزه</button>
                </div>
            `).join('')}
        </div>
    `;

    const createPrizeDisplayView = (prizeRoom) => `
        <h3 class="text-2xl font-bold text-center mb-4">کلید شما برای ماجراجویی بعدی!</h3>
        <div class="bg-gray-700 p-6 rounded-lg text-center">
            <p class="text-gray-300">رمز ورود به اتاق <strong class="text-yellow-400">${prizeRoom.name} (#${prizeRoom.roomNumber})</strong>:</p>
            <p class="text-4xl font-mono bg-gray-900 p-4 rounded-md my-4 tracking-widest">${prizeRoom.password}</p>
            <a href="/dashboard/rooms/${prizeRoom.uniqueIdentifier}" class="btn-primary">ورود به اتاق جدید</a>
        </div>
    `;


    // --- Event Handling ---

    const attachUploadListener = (room, status) => {
        const form = document.getElementById('answer-upload-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fileInput = document.getElementById('answer-file-input');
            if (!fileInput.files.length) {
                showAlert('error', 'لطفا یک فایل را انتخاب کنید.');
                return;
            }
            const formData = new FormData();
            formData.append('answerFile', fileInput.files[0]);

            showLoading();
            try {
                const response = await axios.post(`/api/puzzle-room/${room.id}/submit-answer`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                // The socket event will handle the UI update, but we can show a success message here
                showAlert('success', response.data.message);
                renderPuzzleRoom(room, response.data.status); // Re-render with new status
            } catch (error) {
                const errorMessage = error.response?.data?.message || 'خطا در آپلود فایل.';
                showAlert('error', errorMessage);
            } finally {
                hideLoading();
            }
        });
    };

    const attachClaimPrizeListener = (room, status) => {
        const btn = document.getElementById('claim-prize-btn');
        btn.addEventListener('click', async () => {
            showLoading();
            try {
                const response = await axios.post(`/api/puzzle-room/${status.id}/claim-prize`);
                const prizeContainer = document.getElementById('prize-container');
                if (response.data.prizeOptions && response.data.prizeOptions.length > 0) {
                    prizeContainer.innerHTML = createPrizeSelectionView(response.data.prizeOptions, status);
                    attachSelectPrizeListeners(status);
                } else {
                    prizeContainer.innerHTML = `<p class="text-center text-yellow-400 mt-4">متاسفانه در حال حاضر جایزه‌ای برای شما وجود ندارد. بعدا تلاش کنید!</p>`;
                }
            } catch (error) {
                showAlert('error', error.response?.data?.message || 'خطا در درخواست جایزه.');
            } finally {
                hideLoading();
            }
        });
    };

    const attachSelectPrizeListeners = (originalStatus) => {
        document.querySelectorAll('.select-prize-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const chosenRoomId = e.target.dataset.roomId;
                showLoading();
                try {
                    const response = await axios.post(`/api/puzzle-room/${originalStatus.id}/select-prize`, { chosenRoomId });
                    const prizeContainer = document.getElementById('prize-container');
                    prizeContainer.innerHTML = createPrizeDisplayView(response.data.chosenPrizeRoom);
                    showAlert('success', response.data.message);
                } catch (error) {
                     showAlert('error', error.response?.data?.message || 'خطا در انتخاب جایزه.');
                } finally {
                    hideLoading();
                }
            });
        });
    };

    const attachShowPrizeListener = (room, status) => {
        const btn = document.getElementById('show-prize-btn');
        btn.addEventListener('click', () => {
            const prizeContainer = document.getElementById('prize-container');
            prizeContainer.innerHTML = createPrizeDisplayView(status.chosenPrizeRoom);
        });
    };


    // --- Socket Handlers ---

    window.socket.on('submission_corrected', (data) => {
        // Check if the update is for the currently viewed room
        if (currentRoomData && currentRoomData.status.id === data.groupRoomStatusId) {
             showAlert('success', 'پاسخ شما تصحیح شد! صفحه بروزرسانی می‌شود.');
             // Refetch data to get the most up-to-date status
             fetchAndRenderPuzzleRoom(currentRoomData.room.uniqueIdentifier);
        }
    });


    // --- Initialization ---
    loadPuzzleRoomFromURL();
});
