const { Room, Group, GroupRoomStatus, sequelize } = require('../models');
const { Op } = require('sequelize');

// GET /rooms/:identifier
// Renders the puzzle room page for the user's group.
exports.renderRoom = async (req, res) => {
    const { identifier } = req.params;
    const { userId } = req.session;

    try {
        const user = await sequelize.models.User.findByPk(userId, {
            include: { model: Group, as: 'group' }
        });

        if (!user || !user.group) {
            // This should ideally redirect to a page explaining they need to be in a group
            return res.status(403).json({ message: 'برای دسترسی به این بخش باید عضو یک گروه باشید.' });
        }
        const groupId = user.group.id;

        const room = await Room.findOne({
            where: {
                [Op.or]: [
                    { name: identifier },
                    { uniqueIdentifier: identifier }
                ]
            }
        });

        if (!room) {
            return res.status(404).render('error', { message: 'اتاق معمای مورد نظر یافت نشد.' });
        }

        // Find or create the status for this group in this room
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

        // We will not render a view directly, but send data to the main dashboard
        // The dashboard will then show the puzzle room section based on this data.
        // For now, let's send JSON data. The frontend JS will handle it.
        res.json({
            room: room,
            status: groupStatus
        });

    } catch (error) {
        console.error(`Error rendering room ${identifier}:`, error);
        res.status(500).render('error', { message: 'خطا در بارگذاری اتاق معما.' });
    }
};

// POST /rooms/:roomId/submit-answer
// Handles the submission of an answer file for a puzzle.
exports.submitAnswer = async (req, res) => {
    const { roomId } = req.params;
    const { userId } = req.session;
    const io = req.io;

    if (!req.file) {
        return res.status(400).json({ message: 'فایل پاسخ الزامی است.' });
    }

    try {
        const user = await sequelize.models.User.findByPk(userId, {
            include: { model: Group, as: 'group' }
        });

        if (!user || !user.group) {
            return res.status(403).json({ message: 'برای ارسال پاسخ باید عضو یک گروه باشید.' });
        }
        const groupId = user.group.id;

        const groupStatus = await GroupRoomStatus.findOne({
            where: {
                groupId: groupId,
                roomId: roomId
            }
        });

        if (!groupStatus || groupStatus.status !== 'unanswered') {
             // Clean up uploaded file if the submission is not valid
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'شما در حال حاضر نمی‌توانید برای این اتاق پاسخی ارسال کنید.' });
        }

        groupStatus.answerFile = `/uploads/${req.file.filename}`;
        groupStatus.status = 'pending_correction';
        await groupStatus.save();

        // Notify the user's group that submission is successful and pending
        io.to(`group-${groupId}`).emit('submission_received', {
            groupRoomStatusId: groupStatus.id,
            roomId: groupStatus.roomId,
            status: groupStatus.status
        });

        // Notify admins that a new submission is available
        io.to('admins').emit('new_submission_for_admin');

        res.json({
            message: 'پاسخ شما با موفقیت ارسال شد و در انتظار تصحیح است.',
            status: groupStatus
        });

    } catch (error) {
        console.error(`Error submitting answer for room ${roomId}:`, error);
        // Clean up uploaded file in case of error
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ message: 'خطا در ارسال پاسخ.' });
    }
};

// POST /rooms/:groupRoomStatusId/claim-prize
// Allows a user to see the available prizes after solving a puzzle.
exports.claimPrize = async (req, res) => {
    const { groupRoomStatusId } = req.params;
    const { userId } = req.session;

    try {
        const user = await sequelize.models.User.findByPk(userId, {
            include: { model: Group, as: 'group' }
        });
        if (!user || !user.group) {
            return res.status(403).json({ message: 'برای این عملیات باید عضو یک گروه باشید.' });
        }
        const groupId = user.group.id;

        const currentStatus = await GroupRoomStatus.findByPk(groupRoomStatusId);

        // Security check: ensure the status belongs to the user's group
        if (!currentStatus || currentStatus.groupId !== groupId) {
            return res.status(403).json({ message: 'دسترسی غیر مجاز.' });
        }

        // Validation check
        if (currentStatus.status !== 'corrected' || currentStatus.prizeClaimed) {
            return res.status(400).json({ message: 'شما در حال حاضر نمی‌توانید جایزه دریافت کنید.' });
        }

        // Find all rooms the group has already attempted or solved
        const attemptedRoomIds = (await GroupRoomStatus.findAll({
            where: { groupId: groupId },
            attributes: ['roomId']
        })).map(s => s.roomId);

        // Find up to 3 prize rooms: one from each difficulty, that has not been attempted
        const prizeRooms = [];
        const difficulties = ['easy', 'medium', 'hard'];

        for (const difficulty of difficulties) {
            const room = await Room.findOne({
                where: {
                    id: { [Op.notIn]: attemptedRoomIds },
                    difficulty: difficulty
                },
                order: sequelize.random(), // Pick a random one from the available pool
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

// POST /rooms/:groupRoomStatusId/select-prize
// Allows a user to select one of the available rooms as their prize.
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
            include: [{ model: Group, as: 'group' }]
        });
        if (!user || !user.group) {
            return res.status(403).json({ message: 'برای این عملیات باید عضو یک گروه باشید.' });
        }
        const groupId = user.group.id;

        const groupStatus = await GroupRoomStatus.findByPk(groupRoomStatusId);

        // Security and validation checks
        if (!groupStatus || groupStatus.groupId !== groupId) {
            return res.status(403).json({ message: 'دسترسی غیر مجاز.' });
        }
        if (groupStatus.status !== 'corrected' || groupStatus.prizeClaimed) {
            return res.status(400).json({ message: 'امکان انتخاب جایزه برای این مورد وجود ندارد.' });
        }

        const prizeRoom = await Room.findByPk(chosenRoomId);
        if (!prizeRoom) {
            return res.status(404).json({ message: 'اتاق جایزه انتخاب شده معتبر نیست.' });
        }

        // Ensure the group hasn't already attempted the prize room
        const isAttempted = await GroupRoomStatus.findOne({where: {groupId, roomId: chosenRoomId}});
        if(isAttempted){
            return res.status(400).json({ message: 'شما قبلا این اتاق را به عنوان جایزه انتخاب کرده یا در آن شرکت کرده‌اید.' });
        }


        // Update the status with the chosen prize
        groupStatus.chosenPrizeRoomId = chosenRoomId;
        groupStatus.prizeClaimed = true;
        await groupStatus.save();

        const chosenPrizeRoomDetails = await Room.findByPk(chosenRoomId, {
            attributes: ['name', 'roomNumber', 'password', 'uniqueIdentifier']
        });

        // Notify the user's group that the prize has been selected
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
