import * as express from 'express'
import { body, param, query } from 'express-validator'
import { checkIdOrUUID, checkId } from '../../../helpers/custom-validators/misc'
import { checkVideoRating } from '../../../helpers/custom-validators/video-rates'
import { isVideoRatingTypeValid } from '../../../helpers/custom-validators/videos'
import { logger } from '../../../helpers/logger'
import { areValidationErrors } from '../utils'
import { AccountVideoRateModel } from '../../../models/account/account-video-rate'
import { VideoRateType } from '../../../../shared/models/videos'
import { checkAccountName } from '../../../helpers/custom-validators/accounts'
import { doesVideoExist } from '../../../helpers/middlewares'
import { HttpStatusCode } from '../../../../shared/core-utils/miscs/http-error-codes'

const videoUpdateRateValidator = [
  param('id')
    .custom(checkIdOrUUID),

  body('rating')
    .custom(isVideoRatingTypeValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoRate parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.id, res)) return

    return next()
  }
]

const getAccountVideoRateValidatorFactory = function (rateType: VideoRateType) {
  return [
    param('name')
      .custom(checkAccountName),
    param('videoId')
      .custom(checkId),

    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.debug('Checking videoCommentGetValidator parameters.', { parameters: req.params })

      if (areValidationErrors(req, res)) return

      const rate = await AccountVideoRateModel.loadLocalAndPopulateVideo(rateType, req.params.name, +req.params.videoId)
      if (!rate) {
        return res.status(HttpStatusCode.NOT_FOUND_404)
                  .json({ error: 'Video rate not found' })
      }

      res.locals.accountVideoRate = rate

      return next()
    }
  ]
}

const videoRatingValidator = [
  query('rating')
    .optional()
    .custom(checkVideoRating),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking rating parameter', { parameters: req.params })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  videoUpdateRateValidator,
  getAccountVideoRateValidatorFactory,
  videoRatingValidator
}
