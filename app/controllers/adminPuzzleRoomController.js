const { Room, Group, GroupRoomStatus, sequelize } = require('../models');
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');

// GET /admin/api/rooms
exports.listRooms = async (req, res) => {
    try {
        const rooms = await Room.findAll({
            order: [['roomNumber', 'ASC']]
        });
        res.json(rooms);
    } catch (error) {
        console.error("Error listing puzzle rooms:", error);
        res.status(500).json({ message: 'خطا در دریافت لیست اتاق‌ها', error: error.message });
    }
};

// POST /admin/api/rooms
exports.createRoom = async (req, res) => {
    const { name, roomNumber, password, subject, difficulty, maxPoints } = req.body;

    if (!req.file) {
        return res.status(400).json({ message: 'فایل تصویر سوال الزامی است.' });
    }

    try {
        const newRoom = await Room.create({
            name,
            roomNumber,
            password,
            subject,
            difficulty,
            maxPoints,
            questionImage: `/uploads/${req.file.filename}`
        });
        res.status(201).json(newRoom);
    } catch (error) {
        console.error("Error creating puzzle room:", error);
        // Check for unique constraint violation
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({ message: 'نام یا شماره اتاق تکراری است.' });
        }
        res.status(500).json({ message: 'خطا در ایجاد اتاق جدید', error: error.message });
    }
};

// PUT /admin/api/rooms/:id
exports.updateRoom = async (req, res) => {
    const { id } = req.params;
    const { name, roomNumber, password, subject, difficulty, maxPoints } = req.body;

    try {
        const room = await Room.findByPk(id);
        if (!room) {
            return res.status(404).json({ message: 'اتاق مورد نظر یافت نشد.' });
        }

        const updateData = { name, roomNumber, password, subject, difficulty, maxPoints };

        // If a new image is uploaded, update the path and delete the old one.
        if (req.file) {
            // Delete old image if it exists
            if (room.questionImage) {
                const oldImagePath = path.join(__dirname, '..', 'public', room.questionImage);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }
            updateData.questionImage = `/uploads/${req.file.filename}`;
        }

        await room.update(updateData);
        res.json(room);
    } catch (error) {
        console.error(`Error updating puzzle room ${id}:`, error);
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({ message: 'نام یا شماره اتاق تکراری است.' });
        }
        res.status(500).json({ message: 'خطا در ویرایش اتاق', error: error.message });
    }
};

// DELETE /admin/api/rooms/:id
exports.deleteRoom = async (req, res) => {
    const { id } = req.params;
    try {
        const room = await Room.findByPk(id);
        if (!room) {
            return res.status(404).json({ message: 'اتاق مورد نظر یافت نشد.' });
        }

        // Check if any group has submitted an answer for this room
        const submissionCount = await GroupRoomStatus.count({ where: { roomId: id } });
        if (submissionCount > 0) {
            return res.status(400).json({ message: 'این اتاق قابل حذف نیست زیرا گروه‌ها برای آن پاسخ ارسال کرده‌اند.' });
        }

        // Delete the question image file
        if (room.questionImage) {
            const imagePath = path.join(__dirname, '..', 'public', room.questionImage);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }

        await room.destroy();
        res.status(204).send(); // No content
    } catch (error) {
        console.error(`Error deleting puzzle room ${id}:`, error);
        res.status(500).json({ message: 'خطا در حذف اتاق', error: error.message });
    }
};

// GET /admin/api/submissions
exports.listSubmissions = async (req, res) => {
    try {
        const submissions = await GroupRoomStatus.findAll({
            where: { status: 'pending_correction' },
            include: [
                {
                    model: Group,
                    as: 'group',
                    attributes: ['id', 'name']
                },
                {
                    model: Room,
                    as: 'room',
                    attributes: ['id', 'name', 'roomNumber']
                }
            ],
            order: [['updatedAt', 'ASC']] // Show oldest submissions first
        });
        res.json(submissions);
    } catch (error) {
        console.error("Error listing submissions:", error);
        res.status(500).json({ message: 'خطا در دریافت لیست پاسخ‌ها', error: error.message });
    }
};

// GET /admin/api/submissions/:submissionId
exports.getSubmissionDetails = async (req, res) => {
    const { submissionId } = req.params;
    try {
        const submission = await GroupRoomStatus.findByPk(submissionId, {
            include: [
                {
                    model: Group,
                    as: 'group',
                    attributes: ['name']
                },
                {
                    model: Room,
                    as: 'room',
                    attributes: ['questionImage', 'name']
                }
            ]
        });

        if (!submission) {
            return res.status(404).json({ message: 'پاسخ مورد نظر یافت نشد.' });
        }

        res.json(submission);
    } catch (error) {
        console.error(`Error getting submission details for ${submissionId}:`, error);
        res.status(500).json({ message: 'خطا در دریافت جزئیات پاسخ', error: error.message });
    }
};

// POST /admin/api/submissions/:submissionId/correct
exports.correctSubmission = async (req, res) => {
    const { submissionId } = req.params;
    const { score } = req.body;
    const io = req.io;

    if (score === undefined || score === null) {
        return res.status(400).json({ message: 'نمره الزامی است.' });
    }

    const t = await sequelize.transaction();
    try {
        const submission = await GroupRoomStatus.findByPk(submissionId, {
            include: [{ model: Room, as: 'room' }, { model: Group, as: 'group' }],
            transaction: t
        });

        if (!submission) {
            await t.rollback();
            return res.status(404).json({ message: 'پاسخ مورد نظر یافت نشد.' });
        }

        if (submission.status !== 'pending_correction') {
            await t.rollback();
            return res.status(400).json({ message: 'این پاسخ قبلا تصحیح شده یا در وضعیت دیگری است.' });
        }

        const parsedScore = parseInt(score, 10);
        if (isNaN(parsedScore) || parsedScore < 0 || parsedScore > submission.room.maxPoints) {
            await t.rollback();
            return res.status(400).json({ message: `نمره باید عددی بین 0 و ${submission.room.maxPoints} باشد.` });
        }

        // Update submission status and score
        submission.score = parsedScore;
        submission.status = 'corrected';
        await submission.save({ transaction: t });

        // Add score to the group's total score
        const group = submission.group;
        group.score += parsedScore;
        await group.save({ transaction: t });

        await t.commit();

        // Emit socket event to the specific group
        io.to(`group-${submission.groupId}`).emit('submission_corrected', {
            groupRoomStatusId: submission.id,
            roomId: submission.roomId,
            score: submission.score,
            status: submission.status
        });

        // Emit event to admins to update their submission list
        io.to('admins').emit('submission_list_updated');


        res.json({ message: 'نمره با موفقیت ثبت شد.', newTotalScore: group.score });

    } catch (error) {
        await t.rollback();
        console.error(`Error correcting submission ${submissionId}:`, error);
        res.status(500).json({ message: 'خطا در ثبت نمره', error: error.message });
    }
};
