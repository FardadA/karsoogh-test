const adminChannelsMixin = {
    data: {
        channels: [],
        groupsForSelection: [],
        showChannelForm: false,
        editingChannelId: null,
        channelForm: {
            name: '',
            groupIds: []
        },
        newMessage: {
            channelId: '',
            content: ''
        }
    },
    methods: {
        fetchChannels() {
            axios.get('/admin/api/channels')
                .then(response => {
                    this.channels = response.data;
                })
                .catch(error => {
                    this.showAlert('خطا در دریافت لیست کانال‌ها', 'error');
                });
        },
        fetchGroupsForSelection() {
            axios.get('/admin/api/channels/groups')
                .then(response => {
                    this.groupsForSelection = response.data;
                })
                .catch(error => {
                    this.showAlert('خطا در دریافت لیست گروه‌ها', 'error');
                });
        },
        openCreateChannelForm() {
            this.editingChannelId = null;
            this.channelForm = { name: '', groupIds: [] };
            this.showChannelForm = true;
        },
        openEditChannelForm(channel) {
            this.editingChannelId = channel.id;
            this.channelForm = {
                name: channel.name,
                groupIds: channel.groups.map(g => g.id)
            };
            this.showChannelForm = true;
        },
        closeChannelForm() {
            this.showChannelForm = false;
        },
        saveChannel() {
            const url = this.editingChannelId ? `/admin/api/channels/${this.editingChannelId}` : '/admin/api/channels';
            const method = this.editingChannelId ? 'put' : 'post';

            axios[method](url, this.channelForm)
                .then(() => {
                    this.showAlert('کانال با موفقیت ذخیره شد', 'success');
                    this.fetchChannels();
                    this.closeChannelForm();
                })
                .catch(error => {
                    this.showAlert('خطا در ذخیره کانال', 'error');
                });
        },
        deleteChannel(channel) {
            if (confirm(`آیا از حذف کانال "${channel.name}" اطمینان دارید؟`)) {
                axios.delete(`/admin/api/channels/${channel.id}`)
                    .then(() => {
                        this.showAlert('کانال با موفقیت حذف شد', 'success');
                        this.fetchChannels();
                    })
                    .catch(error => {
                        this.showAlert('خطا در حذف کانال', 'error');
                    });
            }
        },
        sendMessageToChannel() {
            if (!this.newMessage.channelId || !this.newMessage.content) {
                this.showAlert('لطفاً کانال و متن پیام را وارد کنید', 'warning');
                return;
            }
            axios.post('/admin/api/channels/messages', this.newMessage)
                .then(() => {
                    this.showAlert('پیام با موفقیت ارسال شد', 'success');
                    this.newMessage.content = '';
                })
                .catch(error => {
                    this.showAlert('خطا در ارسال پیام', 'error');
                });
        },
        getGroupChannelInfo(group) {
            if (group.channels && group.channels.length > 0) {
                return `(عضو در: ${group.channels.map(c => c.name).join(', ')})`;
            }
            return '';
        }
    },
    created() {
        this.fetchChannels();
        this.fetchGroupsForSelection();
    }
};
