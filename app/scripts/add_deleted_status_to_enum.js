require('dotenv').config({ path: '../.env' });

const { sequelize } = require('../models');

async function addDeletedStatus() {
  const queryInterface = sequelize.getQueryInterface();
  const tableName = 'PuzzleGroupRoomStatuses';
  const columnName = 'status';

  try {
    console.log(`Altering column ${columnName} in table ${tableName}...`);

    await queryInterface.changeColumn(tableName, columnName, {
      type: `ENUM('unanswered', 'pending_correction', 'corrected', 'deleted')`,
      allowNull: false,
      defaultValue: 'unanswered',
    });

    console.log('Column altered successfully. "deleted" status has been added.');
  } catch (error) {
    console.error('Error altering column:', error);
  } finally {
    await sequelize.close();
  }
}

addDeletedStatus();
