import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction,
  queryInterface: Sequelize.QueryInterface,
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  // is360 column
  {
    const data = {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
    await utils.queryInterface.addColumn('video', 'isVideo360', data)
  }

  // sphericalMapping column
  {
    const data = {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null
    }
    await utils.queryInterface.addColumn('video', 'sphericalMapping', data)
  }

}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
