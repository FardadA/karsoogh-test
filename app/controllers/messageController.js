'use strict';

const { Message, User, Group, Channel } = require('../models');

exports.listMessages = async (req, res) => {
    try {
        const user = await User.findByPk(req.session.userId, {
            include: [{
                model: Group,
                as: 'groups',
                include: [{
                    model: Channel,
                    as: 'channels'
                }]
            }]
        });

        if (!user || !user.groups || user.groups.length === 0) {
            return res.json([]);
        }

        const channelIds = new Set();
        user.groups.forEach(group => {
            group.channels.forEach(channel => {
                channelIds.add(channel.id);
            });
        });

        const messages = await Message.findAll({
            where: {
                channelId: Array.from(channelIds)
            },
            include: [{
                model: Channel,
                as: 'channel',
                attributes: ['name']
            }],
            order: [['createdAt', 'DESC']]
        });

        res.json(messages);
    } catch (error) {
        res.status(500).json({ message: 'خطا در دریافت لیست پیام‌ها', error });
    }
};
