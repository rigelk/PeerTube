import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction,
  queryInterface: Sequelize.QueryInterface,
  sequelize: Sequelize.Sequelize,
  db: any
}): Promise<void> {
  {
    const query = `
CREATE TABLE IF NOT EXISTS "timecodeThumbnailManifest"
(
  "id"              SERIAL,
  "filename"        VARCHAR(255)             NOT NULL,
  "fileUrl"             VARCHAR(255),
  "videoId"         INTEGER REFERENCES "video" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "createdAt"       TIMESTAMP WITH TIME ZONE NOT NULL,
  "updatedAt"       TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY ("id")
);
`
    await utils.sequelize.query(query)
  }

  {
    const data = {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'timecodeThumbnailManifest',
        key: 'id'
      },
      onDelete: 'CASCADE'
    }

    await utils.queryInterface.addColumn('thumbnail', 'manifestId', data)
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
