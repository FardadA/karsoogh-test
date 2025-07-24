'use strict';

module.exports = (sequelize, DataTypes) => {
  const Message = sequelize.define('Message', {
    content: {
      type: DataTypes.STRING,
      allowNull: false
    }
  });

  Message.associate = models => {
    Message.belongsTo(models.Channel, {
      foreignKey: 'channelId',
      as: 'channel'
    });

    Message.belongsTo(models.User, {
      foreignKey: 'senderId',
      as: 'sender'
    });
  };

  return Message;
};
