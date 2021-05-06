import * as express from 'express'
import { body, param, query } from 'express-validator'
import { exists, isBooleanValid, isIdOrUUIDValid, isIdValid, toBooleanOrNull, toIntOrNull } from '../../helpers/custom-validators/misc'
import { logger } from '../../helpers/logger'
import { areValidationErrors } from './utils'
import { VideoRedundancyModel } from '../../models/redundancy/video-redundancy'
import { isHostValid } from '../../helpers/custom-validators/servers'
import { ServerModel } from '../../models/server/server'
import { doesVideoExist } from '../../helpers/middlewares'
import { isVideoRedundancyTarget } from '@server/helpers/custom-validators/video-redundancies'
import { HttpStatusCode } from '../../../shared/core-utils/miscs/http-error-codes'

const videoFileRedundancyGetValidator = [
  param('videoId')
    .custom(isIdOrUUIDValid),
  param('resolution')
    .customSanitizer(toIntOrNull)
    .custom(exists).withMessage('Should have a valid resolution'),
  param('fps')
    .optional()
    .customSanitizer(toIntOrNull)
    .custom(exists).withMessage('Should have a valid fps'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoFileRedundancyGetValidator parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res)) return

    const video = res.locals.videoAll

    const paramResolution = req.params.resolution as unknown as number // We casted to int above
    const paramFPS = req.params.fps as unknown as number // We casted to int above

    const videoFile = video.VideoFiles.find(f => {
      return f.resolution === paramResolution && (!req.params.fps || paramFPS)
    })

    if (!videoFile) return res.status(HttpStatusCode.NOT_FOUND_404).json({ error: 'Video file not found.' })
    res.locals.videoFile = videoFile

    const videoRedundancy = await VideoRedundancyModel.loadLocalByFileId(videoFile.id)
    if (!videoRedundancy) return res.status(HttpStatusCode.NOT_FOUND_404).json({ error: 'Video redundancy not found.' })
    res.locals.videoRedundancy = videoRedundancy

    return next()
  }
]

const videoPlaylistRedundancyGetValidator = [
  param('videoId')
    .custom(isIdOrUUIDValid),
  param('streamingPlaylistType')
    .customSanitizer(toIntOrNull)
    .custom(exists).withMessage('Should have a valid streaming playlist type'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoPlaylistRedundancyGetValidator parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res)) return

    const video = res.locals.videoAll

    const paramPlaylistType = req.params.streamingPlaylistType as unknown as number // We casted to int above
    const videoStreamingPlaylist = video.VideoStreamingPlaylists.find(p => p.type === paramPlaylistType)

    if (!videoStreamingPlaylist) return res.status(HttpStatusCode.NOT_FOUND_404).json({ error: 'Video playlist not found.' })
    res.locals.videoStreamingPlaylist = videoStreamingPlaylist

    const videoRedundancy = await VideoRedundancyModel.loadLocalByStreamingPlaylistId(videoStreamingPlaylist.id)
    if (!videoRedundancy) return res.status(HttpStatusCode.NOT_FOUND_404).json({ error: 'Video redundancy not found.' })
    res.locals.videoRedundancy = videoRedundancy

    return next()
  }
]

const updateServerRedundancyValidator = [
  param('host').custom(isHostValid).withMessage('Should have a valid host'),
  body('redundancyAllowed')
    .customSanitizer(toBooleanOrNull)
    .custom(isBooleanValid).withMessage('Should have a valid redundancyAllowed attribute'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking updateServerRedundancy parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return

    const server = await ServerModel.loadByHost(req.params.host)

    if (!server) {
      return res
        .status(HttpStatusCode.NOT_FOUND_404)
        .json({
          error: `Server ${req.params.host} not found.`
        })
        .end()
    }

    res.locals.server = server
    return next()
  }
]

const listVideoRedundanciesValidator = [
  query('target')
    .custom(isVideoRedundancyTarget).withMessage('Should have a valid video redundancies target'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking listVideoRedundanciesValidator parameters', { parameters: req.query })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

const addVideoRedundancyValidator = [
  body('videoId')
    .custom(isIdValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking addVideoRedundancyValidator parameters', { parameters: req.query })

    if (areValidationErrors(req, res)) return

    if (!await doesVideoExist(req.body.videoId, res, 'only-video')) return

    if (res.locals.onlyVideo.remote === false) {
      return res.status(HttpStatusCode.BAD_REQUEST_400)
        .json({ error: 'Cannot create a redundancy on a local video' })
    }

    if (res.locals.onlyVideo.isLive) {
      return res.status(HttpStatusCode.BAD_REQUEST_400)
        .json({ error: 'Cannot create a redundancy of a live video' })
    }

    const alreadyExists = await VideoRedundancyModel.isLocalByVideoUUIDExists(res.locals.onlyVideo.uuid)
    if (alreadyExists) {
      return res.status(HttpStatusCode.CONFLICT_409)
                .json({ error: 'This video is already duplicated by your instance.' })
    }

    return next()
  }
]

const removeVideoRedundancyValidator = [
  param('redundancyId')
    .custom(isIdValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking removeVideoRedundancyValidator parameters', { parameters: req.query })

    if (areValidationErrors(req, res)) return

    const redundancy = await VideoRedundancyModel.loadByIdWithVideo(parseInt(req.params.redundancyId, 10))
    if (!redundancy) {
      return res.status(HttpStatusCode.NOT_FOUND_404)
                .json({ error: 'Video redundancy not found' })
                .end()
    }

    res.locals.videoRedundancy = redundancy

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  videoFileRedundancyGetValidator,
  videoPlaylistRedundancyGetValidator,
  updateServerRedundancyValidator,
  listVideoRedundanciesValidator,
  addVideoRedundancyValidator,
  removeVideoRedundancyValidator
}
