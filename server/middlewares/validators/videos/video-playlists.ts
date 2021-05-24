import * as express from 'express'
import { body, param, query, ValidationChain } from 'express-validator'
import { ExpressPromiseHandler } from '@server/types/express'
import { MUserAccountId } from '@server/types/models'
import { UserRight, VideoPlaylistCreate, VideoPlaylistUpdate } from '../../../../shared'
import { HttpStatusCode } from '../../../../shared/core-utils/miscs/http-error-codes'
import { VideoPlaylistPrivacy } from '../../../../shared/models/videos/playlist/video-playlist-privacy.model'
import { VideoPlaylistType } from '../../../../shared/models/videos/playlist/video-playlist-type.model'
import {
  checkIdOrUUID,
  checkId,
  checkUUID,
  toIntArray,
  toIntOrNull,
  toValueOrNull
} from '../../../helpers/custom-validators/misc'
import {
  checkVideoPlaylistDescription,
  checkVideoPlaylistName,
  checkVideoPlaylistPrivacy,
  checkVideoPlaylistTimestamp,
  checkVideoPlaylistType,
  checkVideoPlaylistVideoIds
} from '../../../helpers/custom-validators/video-playlists'
import { checkVideoImage } from '../../../helpers/custom-validators/videos'
import { cleanUpReqFiles } from '../../../helpers/express-utils'
import { logger } from '../../../helpers/logger'
import { doesVideoChannelIdExist, doesVideoExist, doesVideoPlaylistExist, VideoPlaylistFetchType } from '../../../helpers/middlewares'
import { VideoPlaylistElementModel } from '../../../models/video/video-playlist-element'
import { MVideoPlaylist } from '../../../types/models/video/video-playlist'
import { authenticatePromiseIfNeeded } from '../../auth'
import { areValidationErrors } from '../utils'

const videoPlaylistsAddValidator = getCommonPlaylistEditAttributes().concat([
  body('displayName')
    .custom(checkVideoPlaylistName),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoPlaylistsAddValidator parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return cleanUpReqFiles(req)

    const body: VideoPlaylistCreate = req.body
    if (body.videoChannelId && !await doesVideoChannelIdExist(body.videoChannelId, res)) return cleanUpReqFiles(req)

    if (body.privacy === VideoPlaylistPrivacy.PUBLIC && !body.videoChannelId) {
      cleanUpReqFiles(req)
      return res.status(HttpStatusCode.BAD_REQUEST_400)
                .json({ error: 'Cannot set "public" a playlist that is not assigned to a channel.' })
    }

    return next()
  }
])

const videoPlaylistsUpdateValidator = getCommonPlaylistEditAttributes().concat([
  param('playlistId')
    .custom(checkIdOrUUID),

  body('displayName')
    .optional()
    .custom(checkVideoPlaylistName),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoPlaylistsUpdateValidator parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return cleanUpReqFiles(req)

    if (!await doesVideoPlaylistExist(req.params.playlistId, res, 'all')) return cleanUpReqFiles(req)

    const videoPlaylist = getPlaylist(res)

    if (!checkUserCanManageVideoPlaylist(res.locals.oauth.token.User, videoPlaylist, UserRight.REMOVE_ANY_VIDEO_PLAYLIST, res)) {
      return cleanUpReqFiles(req)
    }

    const body: VideoPlaylistUpdate = req.body

    const newPrivacy = body.privacy || videoPlaylist.privacy
    if (newPrivacy === VideoPlaylistPrivacy.PUBLIC &&
      (
        (!videoPlaylist.videoChannelId && !body.videoChannelId) ||
        body.videoChannelId === null
      )
    ) {
      cleanUpReqFiles(req)
      return res.status(HttpStatusCode.BAD_REQUEST_400)
                .json({ error: 'Cannot set "public" a playlist that is not assigned to a channel.' })
    }

    if (videoPlaylist.type === VideoPlaylistType.WATCH_LATER) {
      cleanUpReqFiles(req)
      return res.status(HttpStatusCode.BAD_REQUEST_400)
                .json({ error: 'Cannot update a watch later playlist.' })
    }

    if (body.videoChannelId && !await doesVideoChannelIdExist(body.videoChannelId, res)) return cleanUpReqFiles(req)

    return next()
  }
])

const videoPlaylistsDeleteValidator = [
  param('playlistId')
    .custom(checkIdOrUUID),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoPlaylistsDeleteValidator parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return

    if (!await doesVideoPlaylistExist(req.params.playlistId, res)) return

    const videoPlaylist = getPlaylist(res)
    if (videoPlaylist.type === VideoPlaylistType.WATCH_LATER) {
      return res.status(HttpStatusCode.BAD_REQUEST_400)
                .json({ error: 'Cannot delete a watch later playlist.' })
    }

    if (!checkUserCanManageVideoPlaylist(res.locals.oauth.token.User, videoPlaylist, UserRight.REMOVE_ANY_VIDEO_PLAYLIST, res)) {
      return
    }

    return next()
  }
]

const videoPlaylistsGetValidator = (fetchType: VideoPlaylistFetchType) => {
  return [
    param('playlistId')
      .custom(checkIdOrUUID),

    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.debug('Checking videoPlaylistsGetValidator parameters', { parameters: req.params })

      if (areValidationErrors(req, res)) return

      if (!await doesVideoPlaylistExist(req.params.playlistId, res, fetchType)) return

      const videoPlaylist = res.locals.videoPlaylistFull || res.locals.videoPlaylistSummary

      // Video is unlisted, check we used the uuid to fetch it
      if (videoPlaylist.privacy === VideoPlaylistPrivacy.UNLISTED) {
        try {
          checkUUID(req.params.playlistId)
        } catch {
          // Don't leak this unlisted video
          return res.status(HttpStatusCode.NOT_FOUND_404).end()
        }

        return next()
      }

      if (videoPlaylist.privacy === VideoPlaylistPrivacy.PRIVATE) {
        await authenticatePromiseIfNeeded(req, res)

        const user = res.locals.oauth ? res.locals.oauth.token.User : null

        if (
          !user ||
          (videoPlaylist.OwnerAccount.id !== user.Account.id && !user.hasRight(UserRight.UPDATE_ANY_VIDEO_PLAYLIST))
        ) {
          return res.status(HttpStatusCode.FORBIDDEN_403)
                    .json({ error: 'Cannot get this private video playlist.' })
        }

        return next()
      }

      return next()
    }
  ]
}

const videoPlaylistsSearchValidator = [
  query('search').optional().not().isEmpty().withMessage('Should have a valid search'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoPlaylists search query', { parameters: req.query })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

const videoPlaylistsAddVideoValidator = [
  param('playlistId')
    .custom(checkIdOrUUID),
  body('videoId')
    .custom(checkIdOrUUID),
  body('startTimestamp')
    .optional()
    .custom(checkVideoPlaylistTimestamp),
  body('stopTimestamp')
    .optional()
    .custom(checkVideoPlaylistTimestamp),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoPlaylistsAddVideoValidator parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return

    if (!await doesVideoPlaylistExist(req.params.playlistId, res, 'all')) return
    if (!await doesVideoExist(req.body.videoId, res, 'only-video')) return

    const videoPlaylist = getPlaylist(res)

    if (!checkUserCanManageVideoPlaylist(res.locals.oauth.token.User, videoPlaylist, UserRight.UPDATE_ANY_VIDEO_PLAYLIST, res)) {
      return
    }

    return next()
  }
]

const videoPlaylistsUpdateOrRemoveVideoValidator = [
  param('playlistId')
    .custom(checkIdOrUUID),
  param('playlistElementId')
    .custom(checkId),
  body('startTimestamp')
    .optional()
    .custom(checkVideoPlaylistTimestamp),
  body('stopTimestamp')
    .optional()
    .custom(checkVideoPlaylistTimestamp),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoPlaylistsRemoveVideoValidator parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return

    if (!await doesVideoPlaylistExist(req.params.playlistId, res, 'all')) return

    const videoPlaylist = getPlaylist(res)

    const videoPlaylistElement = await VideoPlaylistElementModel.loadById(req.params.playlistElementId)
    if (!videoPlaylistElement) {
      res.status(HttpStatusCode.NOT_FOUND_404)
         .json({ error: 'Video playlist element not found' })
         .end()

      return
    }
    res.locals.videoPlaylistElement = videoPlaylistElement

    if (!checkUserCanManageVideoPlaylist(res.locals.oauth.token.User, videoPlaylist, UserRight.UPDATE_ANY_VIDEO_PLAYLIST, res)) return

    return next()
  }
]

const videoPlaylistElementAPGetValidator = [
  param('playlistId')
    .custom(checkIdOrUUID),
  param('playlistElementId')
    .custom(checkId),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoPlaylistElementAPGetValidator parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return

    const playlistElementId = parseInt(req.params.playlistElementId + '', 10)
    const playlistId = req.params.playlistId

    const videoPlaylistElement = await VideoPlaylistElementModel.loadByPlaylistAndElementIdForAP(playlistId, playlistElementId)
    if (!videoPlaylistElement) {
      res.status(HttpStatusCode.NOT_FOUND_404)
         .json({ error: 'Video playlist element not found' })
         .end()

      return
    }

    if (videoPlaylistElement.VideoPlaylist.privacy === VideoPlaylistPrivacy.PRIVATE) {
      return res.status(HttpStatusCode.FORBIDDEN_403).end()
    }

    res.locals.videoPlaylistElementAP = videoPlaylistElement

    return next()
  }
]

const videoPlaylistsReorderVideosValidator = [
  param('playlistId')
    .custom(checkIdOrUUID),
  body('startPosition')
    .isInt({ min: 1 }).withMessage('Should have a valid start position'),
  body('insertAfterPosition')
    .isInt({ min: 0 }).withMessage('Should have a valid insert after position'),
  body('reorderLength')
    .optional()
    .isInt({ min: 1 }).withMessage('Should have a valid range length'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoPlaylistsReorderVideosValidator parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return

    if (!await doesVideoPlaylistExist(req.params.playlistId, res, 'all')) return

    const videoPlaylist = getPlaylist(res)
    if (!checkUserCanManageVideoPlaylist(res.locals.oauth.token.User, videoPlaylist, UserRight.UPDATE_ANY_VIDEO_PLAYLIST, res)) return

    const nextPosition = await VideoPlaylistElementModel.getNextPositionOf(videoPlaylist.id)
    const startPosition: number = req.body.startPosition
    const insertAfterPosition: number = req.body.insertAfterPosition
    const reorderLength: number = req.body.reorderLength

    if (startPosition >= nextPosition || insertAfterPosition >= nextPosition) {
      res.status(HttpStatusCode.BAD_REQUEST_400)
         .json({ error: `Start position or insert after position exceed the playlist limits (max: ${nextPosition - 1})` })
         .end()

      return
    }

    if (reorderLength && reorderLength + startPosition > nextPosition) {
      res.status(HttpStatusCode.BAD_REQUEST_400)
         .json({ error: `Reorder length with this start position exceeds the playlist limits (max: ${nextPosition - startPosition})` })
         .end()

      return
    }

    return next()
  }
]

const commonVideoPlaylistFiltersValidator = [
  query('playlistType')
    .optional()
    .custom(checkVideoPlaylistType),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking commonVideoPlaylistFiltersValidator parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

const doVideosInPlaylistExistValidator = [
  query('videoIds')
    .customSanitizer(toIntArray)
    .custom(checkVideoPlaylistVideoIds),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking areVideosInPlaylistExistValidator parameters', { parameters: req.query })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  videoPlaylistsAddValidator,
  videoPlaylistsUpdateValidator,
  videoPlaylistsDeleteValidator,
  videoPlaylistsGetValidator,
  videoPlaylistsSearchValidator,

  videoPlaylistsAddVideoValidator,
  videoPlaylistsUpdateOrRemoveVideoValidator,
  videoPlaylistsReorderVideosValidator,

  videoPlaylistElementAPGetValidator,

  commonVideoPlaylistFiltersValidator,

  doVideosInPlaylistExistValidator
}

// ---------------------------------------------------------------------------

function getCommonPlaylistEditAttributes () {
  return [
    body('thumbnailfile')
      .custom((value, { req }) => checkVideoImage(req.files, 'thumbnailfile')),

    body('description')
      .optional()
      .customSanitizer(toValueOrNull)
      .custom(checkVideoPlaylistDescription),
    body('privacy')
      .optional()
      .customSanitizer(toIntOrNull)
      .custom(checkVideoPlaylistPrivacy),
    body('videoChannelId')
      .optional()
      .customSanitizer(toIntOrNull)
  ] as (ValidationChain | ExpressPromiseHandler)[]
}

function checkUserCanManageVideoPlaylist (user: MUserAccountId, videoPlaylist: MVideoPlaylist, right: UserRight, res: express.Response) {
  if (videoPlaylist.isOwned() === false) {
    res.status(HttpStatusCode.FORBIDDEN_403)
       .json({ error: 'Cannot manage video playlist of another server.' })
       .end()

    return false
  }

  // Check if the user can manage the video playlist
  // The user can delete it if s/he is an admin
  // Or if s/he is the video playlist's owner
  if (user.hasRight(right) === false && videoPlaylist.ownerAccountId !== user.Account.id) {
    res.status(HttpStatusCode.FORBIDDEN_403)
       .json({ error: 'Cannot manage video playlist of another user' })
       .end()

    return false
  }

  return true
}

function getPlaylist (res: express.Response) {
  return res.locals.videoPlaylistFull || res.locals.videoPlaylistSummary
}
