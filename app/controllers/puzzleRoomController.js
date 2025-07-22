const { Room, Group, GroupRoomStatus, sequelize } = require('../models');
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');

// GET /:identifier
exports.renderRoom = async (req, res) => {
    const { identifier } = req.params;
    const { userId } = req.session;

    try {
        const user = await sequelize.models.User.findByPk(userId, {
            include: { model: Group, as: 'groups' }
        });

        if (!user || !user.groups || user.groups.length === 0) {
            return res.status(403).json({ message: 'برای دسترسی به این بخش باید عضو یک گروه باشید.' });
        }
        const groupId = user.groups[0].id;

        const room = await Room.findOne({
            where: {
                [Op.or]: [
                    { name: identifier },
                    { uniqueIdentifier: identifier }
                ]
            }
        });

        if (!room) {
            return res.status(404).json({ message: 'اتاق معمای مورد نظر یافت نشد.' });
        }

        const [groupStatus, created] = await GroupRoomStatus.findOrCreate({
            where: {
                groupId: groupId,
                roomId: room.id
            },
            defaults: {
                groupId: groupId,
                roomId: room.id,
                status: 'unanswered'
            },
            include: [{model: Room, as: 'chosenPrizeRoom'}]
        });

        res.json({
            room: room,
            status: groupStatus
        });

    } catch (error) {
        console.error(`Error rendering room ${identifier}:`, error);
        res.status(500).json({ message: 'خطا در بارگذاری اتاق معما.' });
    }
};

// POST /:roomId/submit-answer
exports.submitAnswer = async (req, res) => {
    const { roomId } = req.params;
    const { userId } = req.session;
    const io = req.io;

    if (!req.file) {
        return res.status(400).json({ message: 'فایل پاسخ الزامی است.' });
    }

    try {
        const user = await sequelize.models.User.findByPk(userId, {
            include: { model: Group, as: 'groups' }
        });

        if (!user || !user.groups || user.groups.length === 0) {
            return res.status(403).json({ message: 'برای ارسال پاسخ باید عضو یک گروه باشید.' });
        }
        const groupId = user.groups[0].id;

        const groupStatus = await GroupRoomStatus.findOne({
            where: {
                groupId: groupId,
                roomId: roomId
            }
        });

        if (!groupStatus || groupStatus.status !== 'unanswered') {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'شما در حال حاضر نمی‌توانید برای این اتاق پاسخی ارسال کنید.' });
        }

        groupStatus.answerFile = `/uploads/${req.file.filename}`;
        groupStatus.status = 'pending_correction';
        await groupStatus.save();

        io.to(`group-${groupId}`).emit('submission_received', {
            groupRoomStatusId: groupStatus.id,
            roomId: groupStatus.roomId,
            status: groupStatus.status
        });

        io.to('admins').emit('new_submission_for_admin');

        res.json({
            message: 'پاسخ شما با موفقیت ارسال شد و در انتظار تصحیح است.',
            status: groupStatus
        });

    } catch (error) {
        console.error(`Error submitting answer for room ${roomId}:`, error);
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ message: 'خطا در ارسال پاسخ.' });
    }
};

// POST /:groupRoomStatusId/claim-prize
exports.claimPrize = async (req, res) => {
    const { groupRoomStatusId } = req.params;
    const { userId } = req.session;

    try {
        const user = await sequelize.models.User.findByPk(userId, {
            include: { model: Group, as: 'groups' }
        });
        if (!user || !user.groups || user.groups.length === 0) {
            return res.status(403).json({ message: 'برای این عملیات باید عضو یک گروه باشید.' });
        }
        const groupId = user.groups[0].id;

        const currentStatus = await GroupRoomStatus.findByPk(groupRoomStatusId);

        if (!currentStatus || currentStatus.groupId !== groupId) {
            return res.status(403).json({ message: 'دسترسی غیر مجاز.' });
        }

        if (currentStatus.status !== 'corrected' && currentStatus.status !== 'deleted') {
            return res.status(400).json({ message: 'شما در حال حاضر نمی‌توانید جایزه دریافت کنید.' });
        }

        const excludedStatuses = await GroupRoomStatus.findAll({
            where: {
                groupId: groupId,
                [Op.or]: [
                    { status: ['pending_correction', 'corrected', 'deleted'] },
                    { chosenPrizeRoomId: { [Op.ne]: null } }
                ]
            },
            attributes: ['roomId', 'chosenPrizeRoomId']
        });

        const excludedRoomIds = new Set();
        excludedStatuses.forEach(s => {
            if(s.roomId) excludedRoomIds.add(s.roomId);
            if(s.chosenPrizeRoomId) excludedRoomIds.add(s.chosenPrizeRoomId);
        });
        excludedRoomIds.add(currentStatus.roomId);

        const prizeRooms = [];
        const difficulties = ['easy', 'medium', 'hard'];

        for (const difficulty of difficulties) {
            const room = await Room.findOne({
                where: {
                    id: { [Op.notIn]: Array.from(excludedRoomIds) },
                    difficulty: difficulty
                },
                order: sequelize.random(),
            });
            if (room) {
                prizeRooms.push(room);
            }
        }

        res.json({
            message: 'اتاق‌های زیر به عنوان جایزه در دسترس هستند.',
            prizeOptions: prizeRooms
        });

    } catch (error) {
        console.error(`Error claiming prize for status ${groupRoomStatusId}:`, error);
        res.status(500).json({ message: 'خطا در پردازش درخواست جایزه.' });
    }
};

// POST /:groupRoomStatusId/select-prize
exports.selectPrize = async (req, res) => {
    const { groupRoomStatusId } = req.params;
    const { chosenRoomId } = req.body;
    const { userId } = req.session;
    const io = req.io;

    if (!chosenRoomId) {
        return res.status(400).json({ message: 'شناسه اتاق انتخابی الزامی است.' });
    }

    try {
        const user = await sequelize.models.User.findByPk(userId, {
            include: [{ model: Group, as: 'groups' }]
        });
        if (!user || !user.groups || user.groups.length === 0) {
            return res.status(403).json({ message: 'برای این عملیات باید عضو یک گروه باشید.' });
        }
        const groupId = user.groups[0].id;

        const groupStatus = await GroupRoomStatus.findByPk(groupRoomStatusId);

        if (!groupStatus || groupStatus.groupId !== groupId) {
            return res.status(403).json({ message: 'دسترسی غیر مجاز.' });
        }
        if (groupStatus.prizeClaimed) {
            return res.status(400).json({ message: 'امکان انتخاب جایزه برای این مورد وجود ندارد.' });
        }

        const prizeRoom = await Room.findByPk(chosenRoomId);
        if (!prizeRoom) {
            return res.status(404).json({ message: 'اتاق جایزه انتخاب شده معتبر نیست.' });
        }

        const isAttempted = await GroupRoomStatus.findOne({where: {groupId, roomId: chosenRoomId}});
        if(isAttempted){
            return res.status(400).json({ message: 'شما قبلا این اتاق را به عنوان جایزه انتخاب کرده یا در آن شرکت کرده‌اید.' });
        }

        groupStatus.chosenPrizeRoomId = chosenRoomId;
        groupStatus.prizeClaimed = true;
        await groupStatus.save();

        const chosenPrizeRoomDetails = await Room.findByPk(chosenRoomId, {
            attributes: ['name', 'roomNumber', 'password', 'uniqueIdentifier']
        });

        io.to(`group-${groupId}`).emit('prize_selected', {
            groupRoomStatusId: groupStatus.id,
            prizeClaimed: groupStatus.prizeClaimed,
            chosenPrizeRoom: chosenPrizeRoomDetails
        });

        res.json({
            message: 'جایزه با موفقیت انتخاب شد!',
            chosenPrizeRoom: chosenPrizeRoomDetails
        });

    } catch (error) {
        console.error(`Error selecting prize for status ${groupRoomStatusId}:`, error);
        res.status(500).json({ message: 'خطا در انتخاب جایزه.' });
    }
};

// POST /:groupRoomStatusId/delete
exports.deleteSubmission = async (req, res) => {
    const { groupRoomStatusId } = req.params;
    const { userId } = req.session;
    const io = req.io;

    try {
        const user = await sequelize.models.User.findByPk(userId, {
            include: [{ model: Group, as: 'groups' }]
        });
        if (!user || !user.groups || user.groups.length === 0) {
            return res.status(403).json({ message: 'برای این عملیات باید عضو یک گروه باشید.' });
        }
        const groupId = user.groups[0].id;

        const groupStatus = await GroupRoomStatus.findByPk(groupRoomStatusId);

        if (!groupStatus || groupStatus.groupId !== groupId) {
            return res.status(403).json({ message: 'دسترسی غیر مجاز.' });
        }
        if (groupStatus.status !== 'unanswered') {
            return res.status(400).json({ message: 'فقط سوالات پاسخ داده نشده را می‌توان حذف کرد.' });
        }

        groupStatus.status = 'deleted';
        await groupStatus.save();

        io.to(`group-${groupId}`).emit('submission_deleted', {
            groupRoomStatusId: groupStatus.id,
            roomId: groupStatus.roomId,
            status: groupStatus.status
        });

        res.json({
            message: 'سوال با موفقیت حذف شد.',
            status: groupStatus
        });

    } catch (error) {
        console.error(`Error deleting submission ${groupRoomStatusId}:`, error);
        res.status(500).json({ message: 'خطا در حذف سوال.' });
    }
};
