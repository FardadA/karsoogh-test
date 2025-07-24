'use strict';

module.exports = (sequelize, DataTypes) => {
  const Channel = sequelize.define('Channel', {
    name: {
      type: DataTypes.STRING,
      allowNull: false
    }
  });

  Channel.associate = models => {
    Channel.belongsToMany(models.Group, {
      through: 'ChannelGroup',
      as: 'groups',
      foreignKey: 'channelId',
      otherKey: 'groupId'
    });

    Channel.hasMany(models.Message, {
        foreignKey: 'channelId',
        as: 'messages'
    });
  };

  return Channel;
};
