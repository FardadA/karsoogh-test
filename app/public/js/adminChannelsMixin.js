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
        },
        membershipMatrix: {
            groups: [],
            channels: []
        }
    },
    methods: {
        fetchChannels() {
            return axios.get('/admin/api/channels')
                .then(response => {
                    this.channels = response.data;
                })
                .catch(error => {
                    this.sendNotification('error', 'خطا در دریافت لیست کانال‌ها');
                });
        },
        fetchMembershipMatrix() {
            axios.get('/admin/api/channels/membership-matrix')
                .then(response => {
                    this.membershipMatrix = response.data;
                })
                .catch(error => {
                    this.sendNotification('error', 'خطا در دریافت اطلاعات عضویت');
                });
        },
        isMember(group, channelId) {
            return group.channels.some(c => c.id === channelId);
        },
        updateMembership(group, channelId, event) {
            const isMember = event.target.checked;
            axios.post('/admin/api/channels/membership', {
                groupId: group.id,
                channelId,
                isMember
            })
            .then(() => {
                this.sendNotification('success', 'عضویت با موفقیت به‌روزرسانی شد');
                this.fetchMembershipMatrix(); // Refresh the matrix data
            })
            .catch(error => {
                this.sendNotification('error', 'خطا در به‌روزرسانی عضویت');
                event.target.checked = !isMember; // Revert the checkbox on error
            });
        },
        fetchGroupsForSelection() {
            return axios.get('/admin/api/channels/groups')
                .then(response => {
                    this.groupsForSelection = response.data;
                })
                .catch(error => {
                    this.sendNotification('error', 'خطا در دریافت لیست گروه‌ها');
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
                    this.sendNotification('success', 'کانال با موفقیت ذخیره شد');
                    this.fetchChannels();
                    this.closeChannelForm();
                })
                .catch(error => {
                    this.sendNotification('error', 'خطا در ذخیره کانال');
                });
        },
        deleteChannel(channel) {
            if (confirm(`آیا از حذف کانال "${channel.name}" اطمینان دارید؟`)) {
                axios.delete(`/admin/api/channels/${channel.id}`)
                    .then(() => {
                        this.sendNotification('success', 'کانال با موفقیت حذف شد');
                        this.fetchChannels();
                    })
                    .catch(error => {
                        this.sendNotification('error', 'خطا در حذف کانال');
                    });
            }
        },
        sendMessageToChannel() {
            if (!this.newMessage.channelId || !this.newMessage.content) {
                this.sendNotification('warning', 'لطفاً کانال و متن پیام را وارد کنید');
                return;
            }
            axios.post('/admin/api/channels/messages', this.newMessage)
                .then(() => {
                    this.sendNotification('success', 'پیام با موفقیت ارسال شد');
                    this.newMessage.content = '';
                })
                .catch(error => {
                    this.sendNotification('error', 'خطا در ارسال پیام');
                });
        },
        getGroupChannelInfo(group) {
            if (group.channels && group.channels.length > 0) {
                return group.channels.map(c => c.name).join(', ');
            }
            return '';
        }
    },
    created() {
        this.fetchChannels();
        this.fetchGroupsForSelection();
        this.fetchMembershipMatrix();
    }
};
