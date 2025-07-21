const adminPuzzleRoomMixin = {
    data: {
        // Data for Room Management
        puzzleRooms: [],
        showPuzzleRoomFormModal: false,
        editingPuzzleRoom: null,
        puzzleRoomForm: {
            name: '',
            roomNumber: null,
            password: '',
            subject: '',
            difficulty: 'medium',
            maxPoints: 10,
            questionImage: null,
            imagePreview: null,
        },
        // Data for Submission Correction
        puzzleSubmissions: [],
        showPuzzleCorrectionModal: false,
        selectedSubmissionForDetails: null,
        correctionForm: {
            score: 0
        }
    },
    methods: {
        // --- Room Management Methods ---
        async fetchPuzzleRooms() {
            try {
                const response = await axios.get('/admin/api/puzzle-room/rooms');
                this.puzzleRooms = response.data;
            } catch (error) {
                this.sendNotification('error', 'خطا در دریافت لیست اتاق‌های معما.');
                console.error(error);
            }
        },
        openNewPuzzleRoomForm() {
            this.editingPuzzleRoom = null;
            this.puzzleRoomForm = { name: '', roomNumber: null, password: '', subject: '', difficulty: 'medium', maxPoints: 10, questionImage: null, imagePreview: null };
            this.showPuzzleRoomFormModal = true;
        },
        openEditPuzzleRoomForm(room) {
            this.editingPuzzleRoom = { ...room };
            this.puzzleRoomForm = {
                name: room.name,
                roomNumber: room.roomNumber,
                password: room.password,
                subject: room.subject,
                difficulty: room.difficulty,
                maxPoints: room.maxPoints,
                questionImage: null, // Reset file input
                imagePreview: room.questionImage // Show current image
            };
            this.showPuzzleRoomFormModal = true;
        },
        handlePuzzleRoomImageUpload(event) {
            const file = event.target.files[0];
            if (file) {
                this.puzzleRoomForm.questionImage = file;
                this.puzzleRoomForm.imagePreview = URL.createObjectURL(file);
            }
        },
        async savePuzzleRoom() {
            const formData = new FormData();
            Object.keys(this.puzzleRoomForm).forEach(key => {
                if (key !== 'imagePreview' && this.puzzleRoomForm[key] !== null) {
                    formData.append(key, this.puzzleRoomForm[key]);
                }
            });

            const url = this.editingPuzzleRoom
                ? `/admin/api/puzzle-room/rooms/${this.editingPuzzleRoom.id}`
                : '/admin/api/puzzle-room/rooms';
            const method = this.editingPuzzleRoom ? 'put' : 'post';

            try {
                await axios[method](url, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                this.sendNotification('success', `اتاق معما با موفقیت ${this.editingPuzzleRoom ? 'ویرایش' : 'ایجاد'} شد.`);
                this.showPuzzleRoomFormModal = false;
                this.fetchPuzzleRooms();
            } catch (error) {
                this.sendNotification('error', error.response?.data?.message || 'خطا در ذخیره اتاق معما.');
                console.error(error);
            }
        },
        async deletePuzzleRoom(room) {
            if (!confirm(`آیا از حذف اتاق "${room.name}" مطمئن هستید؟ این عمل غیرقابل بازگشت است.`)) return;
            try {
                await axios.delete(`/admin/api/puzzle-room/rooms/${room.id}`);
                this.sendNotification('success', 'اتاق معما با موفقیت حذف شد.');
                this.fetchPuzzleRooms();
            } catch (error) {
                this.sendNotification('error', error.response?.data?.message || 'خطا در حذف اتاق معما.');
                console.error(error);
            }
        },

        // --- Submission Correction Methods ---
        async fetchPuzzleSubmissions() {
            try {
                const response = await axios.get('/admin/api/puzzle-room/submissions');
                this.puzzleSubmissions = response.data;
            } catch (error) {
                this.sendNotification('error', 'خطا در دریافت لیست پاسخ‌های ارسالی.');
                console.error(error);
            }
        },
        async openPuzzleCorrectionModal(submission) {
            try {
                const response = await axios.get(`/admin/api/puzzle-room/submissions/${submission.id}`);
                this.selectedSubmissionForDetails = response.data;
                this.correctionForm.score = 0; // Reset score
                this.showPuzzleCorrectionModal = true;
            } catch (error) {
                this.sendNotification('error', 'خطا در دریافت جزئیات پاسخ.');
                console.error(error);
            }
        },
        async submitPuzzleCorrection() {
            if (!this.selectedSubmissionForDetails) return;
            const submissionId = this.selectedSubmissionForDetails.id;
            try {
                await axios.post(`/admin/api/puzzle-room/submissions/${submissionId}/correct`, {
                    score: this.correctionForm.score
                });
                this.sendNotification('success', 'پاسخ با موفقیت تصحیح و نمره ثبت شد.');
                this.showPuzzleCorrectionModal = false;
                this.fetchPuzzleSubmissions(); // Refresh the list
            } catch (error) {
                this.sendNotification('error', error.response?.data?.message || 'خطا در ثبت نمره.');
                console.error(error);
            }
        },

        handlePuzzleSocketUpdates() {
            window.socket.on('new_submission_for_admin', () => {
                if(this.activeSection === 'puzzle_room_correction') {
                    this.sendNotification('info', 'یک پاسخ جدید برای تصحیح دریافت شد.');
                    this.fetchPuzzleSubmissions();
                }
            });
            window.socket.on('submission_list_updated', () => {
                 if(this.activeSection === 'puzzle_room_correction') {
                    this.fetchPuzzleSubmissions();
                }
            });
        }
    },
    mounted() {
        if (typeof this.handlePuzzleSocketUpdates === 'function') {
            this.handlePuzzleSocketUpdates();
        }
    }
};
