'use strict';

const { Channel, Group, Message, User } = require('../models');

exports.listChannels = async (req, res) => {
    try {
        const channels = await Channel.findAll({
            include: [{
                model: Group,
                as: 'groups',
                attributes: ['id', 'name']
            }]
        });
        res.json(channels);
    } catch (error) {
        res.status(500).json({ message: 'خطا در دریافت لیست کانال‌ها', error });
    }
};

exports.createChannel = async (req, res) => {
    try {
        const { name, groupIds } = req.body;
        const channel = await Channel.create({ name });
        if (groupIds && groupIds.length) {
            await channel.setGroups(groupIds);
        }
        res.status(201).json(channel);
    } catch (error) {
        res.status(500).json({ message: 'خطا در ایجاد کانال', error });
    }
};

exports.updateChannel = async (req, res) => {
    try {
        const { name, groupIds } = req.body;
        const channel = await Channel.findByPk(req.params.id);
        if (!channel) {
            return res.status(404).json({ message: 'کانال مورد نظر یافت نشد' });
        }
        await channel.update({ name });
        if (groupIds) {
            await channel.setGroups(groupIds);
        }
        res.json(channel);
    } catch (error) {
        res.status(500).json({ message: 'خطا در به‌روزرسانی کانال', error });
    }
};

exports.deleteChannel = async (req, res) => {
    try {
        const channel = await Channel.findByPk(req.params.id);
        if (!channel) {
            return res.status(404).json({ message: 'کانال مورد نظر یافت نشد' });
        }
        await channel.destroy();
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ message: 'خطا در حذف کانال', error });
    }
};

exports.sendMessage = async (req, res) => {
    try {
        const { content, channelId } = req.body;
        const senderId = req.session.adminId;

        const message = await Message.create({
            content,
            channelId,
            senderId
        });

        const channel = await Channel.findByPk(channelId, {
            include: [{
                model: Group,
                as: 'groups',
                include: ['members']
            }]
        });

        const userIds = new Set();
        channel.groups.forEach(group => {
            group.members.forEach(member => {
                userIds.add(member.id);
            });
        });

        // Emit the message to the relevant users
        req.io.to(Array.from(userIds).map(id => `user-${id}`)).emit('newMessage', message);

        res.status(201).json(message);
    } catch (error) {
        res.status(500).json({ message: 'خطا در ارسال پیام', error });
    }
};

exports.listGroups = async (req, res) => {
    try {
        const groups = await Group.findAll({
            attributes: ['id', 'name'],
            include: [{
                model: Channel,
                as: 'channels',
                attributes: ['id', 'name']
            }]
        });
        res.json(groups);
    } catch (error) {
        res.status(500).json({ message: 'خطا در دریافت لیست گروه‌ها', error });
    }
};

exports.getMembershipMatrix = async (req, res) => {
    try {
        const groups = await Group.findAll({
            attributes: ['id', 'name'],
            include: [{
                model: Channel,
                as: 'channels',
                attributes: ['id'],
                through: { attributes: [] } // Don't include the pivot table
            }],
            order: [['name', 'ASC']]
        });
        const channels = await Channel.findAll({
            attributes: ['id', 'name'],
            order: [['name', 'ASC']]
        });

        res.json({ groups, channels });
    } catch (error) {
        res.status(500).json({ message: 'خطا در دریافت اطلاعات عضویت', error });
    }
};

exports.updateMembership = async (req, res) => {
    try {
        const { groupId, channelId, isMember } = req.body;
        const group = await Group.findByPk(groupId);
        const channel = await Channel.findByPk(channelId);

        if (!group || !channel) {
            return res.status(404).json({ message: 'گروه یا کانال یافت نشد' });
        }

        if (isMember) {
            await group.addChannel(channel);
        } else {
            await group.removeChannel(channel);
        }

        res.status(200).json({ message: 'عضویت با موفقیت به‌روزرسانی شد' });
    } catch (error) {
        res.status(500).json({ message: 'خطا در به‌روزرسانی عضویت', error });
    }
};
