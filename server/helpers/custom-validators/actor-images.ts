
import { CONSTRAINTS_FIELDS } from '../../initializers/constants'
import { isFileValid } from './misc'

const imageMimeTypes = CONSTRAINTS_FIELDS.ACTORS.IMAGE.EXTNAME
  .map(v => v.replace('.', ''))
  .join('|')
const imageMimeTypesRegex = `image/(${imageMimeTypes})`

/**
 * @throws {Error}
 */
function checkActorImageFile (files: { [ fieldname: string ]: Express.Multer.File[] } | Express.Multer.File[], fieldname: string) {
  return isFileValid(files, imageMimeTypesRegex, fieldname, CONSTRAINTS_FIELDS.ACTORS.IMAGE.FILE_SIZE.max)
}

// ---------------------------------------------------------------------------

export {
  checkActorImageFile
}
