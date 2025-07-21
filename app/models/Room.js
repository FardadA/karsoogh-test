'use strict';
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) => {
  const Room = sequelize.define('Room', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: 'نام منحصر به فرد اتاق برای استفاده در URL (مثلاً puzzle-of-sphinx)'
    },
    roomNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'شماره نمایشی اتاق (مثلاً 4)'
    },
    uniqueIdentifier: {
      type: DataTypes.STRING(16),
      allowNull: false,
      unique: true,
      comment: 'شناسه ۱۶ رقمی یکتا و غیرقابل تغییر'
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'رمز ورود به اتاق که به عنوان جایزه داده می‌شود'
    },
    subject: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'موضوع معما (مثلاً "ریاضیات", "تاریخ")'
    },
    difficulty: {
      type: DataTypes.ENUM('easy', 'medium', 'hard'),
      allowNull: false,
      comment: 'سطح سختی معما'
    },
    maxPoints: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'حداکثر امتیازی که برای این اتاق در نظر گرفته شده'
    },
    questionImage: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'مسیر فایل عکس سوال'
    }
  }, {
    tableName: 'PuzzleRooms',
    comment: 'جدول اتاق‌های معما',
    hooks: {
      beforeValidate: (room) => {
        if (!room.uniqueIdentifier) {
          room.uniqueIdentifier = uuidv4().replace(/-/g, '').substring(0, 16);
        }
      }
    }
  });

  Room.associate = (models) => {
    // A room can be a prize for solving another room's puzzle.
    // The GroupRoomStatus table links a group's performance in one room
    // to the prize they chose, which is another room.
    Room.hasMany(models.GroupRoomStatus, {
      foreignKey: 'chosenPrizeRoomId',
      as: 'prizeForStatus'
    });
  };

  return Room;
};
