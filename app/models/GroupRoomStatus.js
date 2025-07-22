'use strict';

module.exports = (sequelize, DataTypes) => {
  const GroupRoomStatus = sequelize.define('GroupRoomStatus', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    status: {
      type: DataTypes.ENUM('unanswered', 'pending_correction', 'corrected', 'deleted'),
      defaultValue: 'unanswered',
      allowNull: false,
      comment: 'وضعیت پاسخ گروه در اتاق'
    },
    answerFile: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'مسیر فایل پاسخ آپلود شده توسط گروه'
    },
    score: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'نمره‌ای که ادمین ثبت کرده'
    },
    prizeClaimed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: 'مشخص می‌کند آیا جایزه دریافت شده یا نه'
    }
    // Foreign keys (groupId, roomId, chosenPrizeRoomId) will be added via associations
  }, {
    tableName: 'PuzzleGroupRoomStatuses',
    comment: 'جدول وضعیت گروه‌ها در اتاق‌های معما'
  });

  GroupRoomStatus.associate = (models) => {
    // Each status belongs to one Group
    GroupRoomStatus.belongsTo(models.Group, {
      foreignKey: {
        name: 'groupId',
        allowNull: false
      },
      as: 'group'
    });

    // Each status belongs to one Room (the room of the puzzle)
    GroupRoomStatus.belongsTo(models.Room, {
      foreignKey: {
        name: 'roomId',
        allowNull: false
      },
      as: 'room'
    });

    // Each status can have one chosen prize room
    GroupRoomStatus.belongsTo(models.Room, {
      foreignKey: {
        name: 'chosenPrizeRoomId',
        allowNull: true // It's null until a prize is chosen
      },
      as: 'chosenPrizeRoom'
    });
  };

  return GroupRoomStatus;
};
