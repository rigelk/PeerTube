import * as express from 'express'
import { extname, join } from 'path'
import { VideoCreate, VideoPrivacy, VideoState, VideoUpdate } from '../../../../shared'
import { getVideoFileFPS, getVideoFileResolution } from '../../../helpers/ffmpeg-utils'
import { processImage } from '../../../helpers/image-utils'
import { logger } from '../../../helpers/logger'
import { auditLoggerFactory, getAuditIdFromRes, VideoAuditView } from '../../../helpers/audit-logger'
import { getFormattedObjects, getServerActor } from '../../../helpers/utils'
import {
  CONFIG,
  IMAGE_MIMETYPE_EXT,
  PREVIEWS_SIZE,
  sequelizeTypescript,
  THUMBNAILS_SIZE,
  VIDEO_CATEGORIES,
  VIDEO_LANGUAGES,
  VIDEO_LICENCES,
  VIDEO_MIMETYPE_EXT,
  VIDEO_PRIVACIES
} from '../../../initializers'
import {
  changeVideoChannelShare,
  federateVideoIfNeeded,
  fetchRemoteVideoDescription,
  getVideoActivityPubUrl
} from '../../../lib/activitypub'
import { sendCreateView } from '../../../lib/activitypub/send'
import { JobQueue } from '../../../lib/job-queue'
import { Redis } from '../../../lib/redis'
import {
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  commonVideosFiltersValidator,
  optionalAuthenticate,
  paginationValidator,
  setDefaultPagination,
  setDefaultSort,
  videosAddValidator,
  videosGetValidator,
  videosRemoveValidator,
  videosSortValidator,
  videosUpdateValidator
} from '../../../middlewares'
import { TagModel } from '../../../models/video/tag'
import { VideoModel } from '../../../models/video/video'
import { VideoFileModel } from '../../../models/video/video-file'
import { abuseVideoRouter } from './abuse'
import { blacklistRouter } from './blacklist'
import { videoCommentRouter } from './comment'
import { rateVideoRouter } from './rate'
import { ownershipVideoRouter } from './ownership'
import { VideoFilter } from '../../../../shared/models/videos/video-query.type'
import { buildNSFWFilter, createReqFiles } from '../../../helpers/express-utils'
import { ScheduleVideoUpdateModel } from '../../../models/video/schedule-video-update'
import { videoCaptionsRouter } from './captions'
import { videoImportsRouter } from './import'
import { resetSequelizeInstance } from '../../../helpers/database-utils'
import { rename } from 'fs-extra'
import { watchingRouter } from './watching'

const auditLogger = auditLoggerFactory('videos')
const videosRouter = express.Router()

const reqVideoFileAdd = createReqFiles(
  [ 'videofile', 'thumbnailfile', 'previewfile' ],
  Object.assign({}, VIDEO_MIMETYPE_EXT, IMAGE_MIMETYPE_EXT),
  {
    videofile: CONFIG.STORAGE.VIDEOS_DIR,
    thumbnailfile: CONFIG.STORAGE.THUMBNAILS_DIR,
    previewfile: CONFIG.STORAGE.PREVIEWS_DIR
  }
)
const reqVideoFileUpdate = createReqFiles(
  [ 'thumbnailfile', 'previewfile' ],
  IMAGE_MIMETYPE_EXT,
  {
    thumbnailfile: CONFIG.STORAGE.THUMBNAILS_DIR,
    previewfile: CONFIG.STORAGE.PREVIEWS_DIR
  }
)

/**
 * @swagger
 *
 * components:
 *   schemas:
 *     VideoConstantNumber:
 *       properties:
 *         id:
 *           type: number
 *         label:
 *           type: string
 *     VideoConstantString:
 *       properties:
 *         id:
 *           type: string
 *         label:
 *           type: string
 *     VideoPrivacy:
 *       type: string
 *       enum: [Public, Unlisted, Private]
 *     Video:
 *       properties:
 *         id:
 *           type: number
 *         uuid:
 *           type: string
 *         createdAt:
 *           type: string
 *         publishedAt:
 *           type: string
 *         updatedAt:
 *           type: string
 *         category:
 *           $ref: "#/components/schemas/VideoConstantNumber"
 *         licence:
 *           $ref: "#/components/schemas/VideoConstantNumber"
 *         language:
 *           $ref: "#/components/schemas/VideoConstantString"
 *         privacy:
 *           $ref: "#/components/schemas/VideoPrivacy"
 *         description:
 *           type: string
 *         duration:
 *           type: number
 *         isLocal:
 *           type: boolean
 *         name:
 *           type: string
 *         thumbnailPath:
 *           type: string
 *         previewPath:
 *           type: string
 *         embedPath:
 *           type: string
 *         views:
 *           type: number
 *         likes:
 *           type: number
 *         dislikes:
 *           type: number
 *         nsfw:
 *           type: boolean
 *         account:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *             displayName:
 *               type: string
 *             url:
 *               type: string
 *             host:
 *               type: string
 *             avatar:
 *               $ref: "#/components/schemas/Avatar"
 */

videosRouter.use('/', abuseVideoRouter)
videosRouter.use('/', blacklistRouter)
videosRouter.use('/', rateVideoRouter)
videosRouter.use('/', videoCommentRouter)
videosRouter.use('/', videoCaptionsRouter)
videosRouter.use('/', videoImportsRouter)
videosRouter.use('/', ownershipVideoRouter)
videosRouter.use('/', watchingRouter)

/**
 * @swagger
 *
 * /videos/categories:
 *   get:
 *     operationId: getVideoCategories
 *     summary: Gets list of video categories known by the server
 *     tags:
 *       - Video
 *     responses:
 *       '200':
 *         description: successful operation
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 */
videosRouter.get('/categories', listVideoCategories)

/**
 * @swagger
 *
 * /videos/licences:
 *   get:
 *     operationId: getVideoLicences
 *     summary: Gets list of video licences known by the server
 *     tags:
 *       - Video
 *     responses:
 *       '200':
 *         description: successful operation
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 */
videosRouter.get('/licences', listVideoLicences)

/**
 * @swagger
 *
 * /videos/languages:
 *   get:
 *     operationId: getVideoLanguages
 *     summary: Gets list of languages known by the server
 *     tags:
 *       - Video
 *     responses:
 *       '200':
 *         description: successful operation
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 */
videosRouter.get('/languages', listVideoLanguages)

/**
 * @swagger
 *
 * /videos/privacies:
 *   get:
 *     operationId: getVideoPrivacies
 *     summary: Gets list of privacy policies supported by the server
 *     tags:
 *       - Video
 *     responses:
 *       '200':
 *         description: successful operation
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 */
videosRouter.get('/privacies', listVideoPrivacies)

/**
 * @swagger
 *
 * /videos:
 *   get:
 *     operationId: getVideos
 *     summary: Gets list of videos
 *     tags:
 *       - Video
 *     parameters:
 *       - name: category
 *         in: query
 *         required: false
 *         schema:
 *           type: number
 *         description: category id of the video
 *       - $ref: "commons.yaml#/parameters/start"
 *       - $ref: "commons.yaml#/parameters/count"
 *       - $ref: "commons.yaml#/parameters/sort"
 *     responses:
 *       '200':
 *         description: successful operation
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Video'
 */
videosRouter.get('/',
  paginationValidator,
  videosSortValidator,
  setDefaultSort,
  setDefaultPagination,
  optionalAuthenticate,
  commonVideosFiltersValidator,
  asyncMiddleware(listVideos)
)

/**
 * @swagger
 *
 * "/videos/{id}":
 *   put:
 *     operationId: putVideoMetadataById
 *     summary: Updates metadata for a video by its id
 *     security:
 *       - OAuth2: [ ]
 *     tags:
 *       - Video
 *     parameters:
 *       - $ref: "videos.yaml#/parameters/id"
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               thumbnailfile:
 *                 $ref: "videos.yaml#/parameters/thumbnailfile"
 *               previewfile:
 *                 $ref: "videos.yaml#/parameters/previewfile"
 *               category:
 *                 $ref: "videos.yaml#/parameters/category"
 *               licence:
 *                 $ref: "videos.yaml#/parameters/licence"
 *               language:
 *                 $ref: "videos.yaml#/parameters/language"
 *               description:
 *                 $ref: "videos.yaml#/parameters/description"
 *               waitTranscoding:
 *                 $ref: "videos.yaml#/parameters/waitTranscoding"
 *               support:
 *                 $ref: "videos.yaml#/parameters/support"
 *               nsfw:
 *                 $ref: "videos.yaml#/parameters/nsfw"
 *               name:
 *                 $ref: "videos.yaml#/parameters/name"
 *               tags:
 *                 $ref: "videos.yaml#/parameters/tags"
 *               commentsEnabled:
 *                 $ref: "videos.yaml#/parameters/commentsEnabled"
 *               privacy:
 *                 $ref: "videos.yaml#/parameters/privacy"
 *               scheduleUpdate:
 *                 $ref: "videos.yaml#/parameters/scheduleUpdate"
 *     responses:
 *       '200':
 *         description: successful operation
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Video'
 */
videosRouter.put('/:id',
  authenticate,
  reqVideoFileUpdate,
  asyncMiddleware(videosUpdateValidator),
  asyncRetryTransactionMiddleware(updateVideo)
)

/**
 * @swagger
 *
 * /videos/upload:
 *   post:
 *     operationId: uploadVideo
 *     summary: Uploads a video file with its metadata
 *     security:
 *       - OAuth2: [ ]
 *     tags:
 *       - Video
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               videofile:
 *                 type: string
 *                 format: binary
 *                 description: 'Video file'
 *               channelId:
 *                 type: number
 *                 description: 'Channel id that will contain this video'
 *               thumbnailfile:
 *                 $ref: "videos.yaml#/parameters/thumbnailfile"
 *               previewfile:
 *                 $ref: "videos.yaml#/parameters/previewfile"
 *               category:
 *                 $ref: "videos.yaml#/parameters/category"
 *               licence:
 *                 $ref: "videos.yaml#/parameters/licence"
 *               language:
 *                 $ref: "videos.yaml#/parameters/language"
 *               description:
 *                 $ref: "videos.yaml#/parameters/description"
 *               waitTranscoding:
 *                 $ref: "videos.yaml#/parameters/waitTranscoding"
 *               support:
 *                 $ref: "videos.yaml#/parameters/support"
 *               nsfw:
 *                 $ref: "videos.yaml#/parameters/nsfw"
 *               name:
 *                 $ref: "videos.yaml#/parameters/name"
 *               tags:
 *                 $ref: "videos.yaml#/parameters/tags"
 *               commentsEnabled:
 *                 $ref: "videos.yaml#/parameters/commentsEnabled"
 *               privacy:
 *                 $ref: "videos.yaml#/parameters/privacy"
 *               scheduleUpdate:
 *                 $ref: "videos.yaml#/parameters/scheduleUpdate"
 *     responses:
 *       '200':
 *         description: successful operation
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "commons.yaml#/responses/VideoUploadResponse"
 */
videosRouter.post('/upload',
  authenticate,
  reqVideoFileAdd,
  asyncMiddleware(videosAddValidator),
  asyncRetryTransactionMiddleware(addVideo)
)

/**
 * @swagger
 *
 * "/videos/{id}/description":
 *   get:
 *     operationId: getVideoDescriptionById
 *     summary: Gets a video description by its id
 *     tags:
 *       - Video
 *     parameters:
 *       - $ref: "videos.yaml#/parameters/id"
 *     responses:
 *       '200':
 *         description: successful operation
 *         content:
 *           application/json:
 *             schema:
 *               type: string
 */
videosRouter.get('/:id/description',
  asyncMiddleware(videosGetValidator),
  asyncMiddleware(getVideoDescription)
)

/**
 * @swagger
 *
 * '/videos/{id}':
 *   get:
 *     operationId: getVideoById
 *     summary: Gets a video by its id
 *     tags:
 *       - Video
 *     parameters:
 *       - $ref: "videos.yaml#/parameters/id"
 *     responses:
 *       '200':
 *         description: successful operation
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Video'
 */
videosRouter.get('/:id',
  optionalAuthenticate,
  asyncMiddleware(videosGetValidator),
  getVideo
)

/**
 * @swagger
 *
 * "/videos/{id}/views":
 *   post:
 *     operationId: createVideoViewById
 *     summary: Adds a view to the video by its id
 *     tags:
 *       - Video
 *     parameters:
 *       - $ref: "videos.yaml#/parameters/id"
 *     responses:
 *       '204':
 *         $ref: "commons.yaml#/responses/emptySuccess"
 */
videosRouter.post('/:id/views',
  asyncMiddleware(videosGetValidator),
  asyncMiddleware(viewVideo)
)

/**
 * @swagger
 *
 * '/videos/{id}':
 *   delete:
 *     operationId: deleteVideobyId
 *     summary: Deletes a video by its id
 *     security:
 *       - OAuth2: [ ]
 *     tags:
 *       - Video
 *     parameters:
 *       - $ref: "videos.yaml#/parameters/id"
 *     responses:
 *       '204':
 *         $ref: "commons.yaml#/responses/emptySuccess"
 */
videosRouter.delete('/:id',
  authenticate,
  asyncMiddleware(videosRemoveValidator),
  asyncRetryTransactionMiddleware(removeVideo)
)

// ---------------------------------------------------------------------------

export {
  videosRouter
}

// ---------------------------------------------------------------------------

function listVideoCategories (req: express.Request, res: express.Response) {
  res.json(VIDEO_CATEGORIES)
}

function listVideoLicences (req: express.Request, res: express.Response) {
  res.json(VIDEO_LICENCES)
}

function listVideoLanguages (req: express.Request, res: express.Response) {
  res.json(VIDEO_LANGUAGES)
}

function listVideoPrivacies (req: express.Request, res: express.Response) {
  res.json(VIDEO_PRIVACIES)
}

// ---------------------------------------------------------------------------

async function addVideo (req: express.Request, res: express.Response) {
  // Processing the video could be long
  // Set timeout to 10 minutes
  req.setTimeout(1000 * 60 * 10, () => {
    logger.error('Upload video has timed out.')
    return res.sendStatus(408)
  })

  const videoPhysicalFile = req.files['videofile'][0]
  const videoInfo: VideoCreate = req.body

  // Prepare data so we don't block the transaction
  const videoData = {
    name: videoInfo.name,
    remote: false,
    category: videoInfo.category,
    licence: videoInfo.licence,
    language: videoInfo.language,
    commentsEnabled: videoInfo.commentsEnabled || false,
    waitTranscoding: videoInfo.waitTranscoding || false,
    state: CONFIG.TRANSCODING.ENABLED ? VideoState.TO_TRANSCODE : VideoState.PUBLISHED,
    nsfw: videoInfo.nsfw || false,
    description: videoInfo.description,
    support: videoInfo.support,
    privacy: videoInfo.privacy,
    duration: videoPhysicalFile['duration'], // duration was added by a previous middleware
    channelId: res.locals.videoChannel.id
  }
  const video = new VideoModel(videoData)
  video.url = getVideoActivityPubUrl(video) // We use the UUID, so set the URL after building the object

  // Build the file object
  const { videoFileResolution } = await getVideoFileResolution(videoPhysicalFile.path)
  const fps = await getVideoFileFPS(videoPhysicalFile.path)

  const videoFileData = {
    extname: extname(videoPhysicalFile.filename),
    resolution: videoFileResolution,
    size: videoPhysicalFile.size,
    fps
  }
  const videoFile = new VideoFileModel(videoFileData)

  // Move physical file
  const videoDir = CONFIG.STORAGE.VIDEOS_DIR
  const destination = join(videoDir, video.getVideoFilename(videoFile))
  await rename(videoPhysicalFile.path, destination)
  // This is important in case if there is another attempt in the retry process
  videoPhysicalFile.filename = video.getVideoFilename(videoFile)
  videoPhysicalFile.path = destination

  // Process thumbnail or create it from the video
  const thumbnailField = req.files['thumbnailfile']
  if (thumbnailField) {
    const thumbnailPhysicalFile = thumbnailField[0]
    await processImage(thumbnailPhysicalFile, join(CONFIG.STORAGE.THUMBNAILS_DIR, video.getThumbnailName()), THUMBNAILS_SIZE)
  } else {
    await video.createThumbnail(videoFile)
  }

  // Process preview or create it from the video
  const previewField = req.files['previewfile']
  if (previewField) {
    const previewPhysicalFile = previewField[0]
    await processImage(previewPhysicalFile, join(CONFIG.STORAGE.PREVIEWS_DIR, video.getPreviewName()), PREVIEWS_SIZE)
  } else {
    await video.createPreview(videoFile)
  }

  // Create the torrent file
  await video.createTorrentAndSetInfoHash(videoFile)

  const videoCreated = await sequelizeTypescript.transaction(async t => {
    const sequelizeOptions = { transaction: t }

    const videoCreated = await video.save(sequelizeOptions)
    // Do not forget to add video channel information to the created video
    videoCreated.VideoChannel = res.locals.videoChannel

    videoFile.videoId = video.id
    await videoFile.save(sequelizeOptions)

    video.VideoFiles = [ videoFile ]

    // Create tags
    if (videoInfo.tags !== undefined) {
      const tagInstances = await TagModel.findOrCreateTags(videoInfo.tags, t)

      await video.$set('Tags', tagInstances, sequelizeOptions)
      video.Tags = tagInstances
    }

    // Schedule an update in the future?
    if (videoInfo.scheduleUpdate) {
      await ScheduleVideoUpdateModel.create({
        videoId: video.id,
        updateAt: videoInfo.scheduleUpdate.updateAt,
        privacy: videoInfo.scheduleUpdate.privacy || null
      }, { transaction: t })
    }

    await federateVideoIfNeeded(video, true, t)

    auditLogger.create(getAuditIdFromRes(res), new VideoAuditView(videoCreated.toFormattedDetailsJSON()))
    logger.info('Video with name %s and uuid %s created.', videoInfo.name, videoCreated.uuid)

    return videoCreated
  })

  if (video.state === VideoState.TO_TRANSCODE) {
    // Put uuid because we don't have id auto incremented for now
    const dataInput = {
      videoUUID: videoCreated.uuid,
      isNewVideo: true
    }

    await JobQueue.Instance.createJob({ type: 'video-file', payload: dataInput })
  }

  return res.json({
    video: {
      id: videoCreated.id,
      uuid: videoCreated.uuid
    }
  }).end()
}

async function updateVideo (req: express.Request, res: express.Response) {
  const videoInstance: VideoModel = res.locals.video
  const videoFieldsSave = videoInstance.toJSON()
  const oldVideoAuditView = new VideoAuditView(videoInstance.toFormattedDetailsJSON())
  const videoInfoToUpdate: VideoUpdate = req.body
  const wasPrivateVideo = videoInstance.privacy === VideoPrivacy.PRIVATE

  // Process thumbnail or create it from the video
  if (req.files && req.files['thumbnailfile']) {
    const thumbnailPhysicalFile = req.files['thumbnailfile'][0]
    await processImage(thumbnailPhysicalFile, join(CONFIG.STORAGE.THUMBNAILS_DIR, videoInstance.getThumbnailName()), THUMBNAILS_SIZE)
  }

  // Process preview or create it from the video
  if (req.files && req.files['previewfile']) {
    const previewPhysicalFile = req.files['previewfile'][0]
    await processImage(previewPhysicalFile, join(CONFIG.STORAGE.PREVIEWS_DIR, videoInstance.getPreviewName()), PREVIEWS_SIZE)
  }

  try {
    await sequelizeTypescript.transaction(async t => {
      const sequelizeOptions = {
        transaction: t
      }
      const oldVideoChannel = videoInstance.VideoChannel

      if (videoInfoToUpdate.name !== undefined) videoInstance.set('name', videoInfoToUpdate.name)
      if (videoInfoToUpdate.category !== undefined) videoInstance.set('category', videoInfoToUpdate.category)
      if (videoInfoToUpdate.licence !== undefined) videoInstance.set('licence', videoInfoToUpdate.licence)
      if (videoInfoToUpdate.language !== undefined) videoInstance.set('language', videoInfoToUpdate.language)
      if (videoInfoToUpdate.nsfw !== undefined) videoInstance.set('nsfw', videoInfoToUpdate.nsfw)
      if (videoInfoToUpdate.waitTranscoding !== undefined) videoInstance.set('waitTranscoding', videoInfoToUpdate.waitTranscoding)
      if (videoInfoToUpdate.support !== undefined) videoInstance.set('support', videoInfoToUpdate.support)
      if (videoInfoToUpdate.description !== undefined) videoInstance.set('description', videoInfoToUpdate.description)
      if (videoInfoToUpdate.commentsEnabled !== undefined) videoInstance.set('commentsEnabled', videoInfoToUpdate.commentsEnabled)
      if (videoInfoToUpdate.privacy !== undefined) {
        const newPrivacy = parseInt(videoInfoToUpdate.privacy.toString(), 10)
        videoInstance.set('privacy', newPrivacy)

        if (wasPrivateVideo === true && newPrivacy !== VideoPrivacy.PRIVATE) {
          videoInstance.set('publishedAt', new Date())
        }
      }

      const videoInstanceUpdated = await videoInstance.save(sequelizeOptions)

      // Video tags update?
      if (videoInfoToUpdate.tags !== undefined) {
        const tagInstances = await TagModel.findOrCreateTags(videoInfoToUpdate.tags, t)

        await videoInstanceUpdated.$set('Tags', tagInstances, sequelizeOptions)
        videoInstanceUpdated.Tags = tagInstances
      }

      // Video channel update?
      if (res.locals.videoChannel && videoInstanceUpdated.channelId !== res.locals.videoChannel.id) {
        await videoInstanceUpdated.$set('VideoChannel', res.locals.videoChannel, { transaction: t })
        videoInstanceUpdated.VideoChannel = res.locals.videoChannel

        if (wasPrivateVideo === false) await changeVideoChannelShare(videoInstanceUpdated, oldVideoChannel, t)
      }

      // Schedule an update in the future?
      if (videoInfoToUpdate.scheduleUpdate) {
        await ScheduleVideoUpdateModel.upsert({
          videoId: videoInstanceUpdated.id,
          updateAt: videoInfoToUpdate.scheduleUpdate.updateAt,
          privacy: videoInfoToUpdate.scheduleUpdate.privacy || null
        }, { transaction: t })
      } else if (videoInfoToUpdate.scheduleUpdate === null) {
        await ScheduleVideoUpdateModel.deleteByVideoId(videoInstanceUpdated.id, t)
      }

      const isNewVideo = wasPrivateVideo && videoInstanceUpdated.privacy !== VideoPrivacy.PRIVATE
      await federateVideoIfNeeded(videoInstanceUpdated, isNewVideo, t)

      auditLogger.update(
        getAuditIdFromRes(res),
        new VideoAuditView(videoInstanceUpdated.toFormattedDetailsJSON()),
        oldVideoAuditView
      )
      logger.info('Video with name %s and uuid %s updated.', videoInstance.name, videoInstance.uuid)
    })
  } catch (err) {
    // Force fields we want to update
    // If the transaction is retried, sequelize will think the object has not changed
    // So it will skip the SQL request, even if the last one was ROLLBACKed!
    resetSequelizeInstance(videoInstance, videoFieldsSave)

    throw err
  }

  return res.type('json').status(204).end()
}

function getVideo (req: express.Request, res: express.Response) {
  const videoInstance = res.locals.video

  return res.json(videoInstance.toFormattedDetailsJSON())
}

async function viewVideo (req: express.Request, res: express.Response) {
  const videoInstance = res.locals.video

  const ip = req.ip
  const exists = await Redis.Instance.isVideoIPViewExists(ip, videoInstance.uuid)
  if (exists) {
    logger.debug('View for ip %s and video %s already exists.', ip, videoInstance.uuid)
    return res.status(204).end()
  }

  await Promise.all([
    Redis.Instance.addVideoView(videoInstance.id),
    Redis.Instance.setIPVideoView(ip, videoInstance.uuid)
  ])

  const serverActor = await getServerActor()

  await sendCreateView(serverActor, videoInstance, undefined)

  return res.status(204).end()
}

async function getVideoDescription (req: express.Request, res: express.Response) {
  const videoInstance = res.locals.video
  let description = ''

  if (videoInstance.isOwned()) {
    description = videoInstance.description
  } else {
    description = await fetchRemoteVideoDescription(videoInstance)
  }

  return res.json({ description })
}

async function listVideos (req: express.Request, res: express.Response, next: express.NextFunction) {
  const resultList = await VideoModel.listForApi({
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort,
    includeLocalVideos: true,
    categoryOneOf: req.query.categoryOneOf,
    licenceOneOf: req.query.licenceOneOf,
    languageOneOf: req.query.languageOneOf,
    tagsOneOf: req.query.tagsOneOf,
    tagsAllOf: req.query.tagsAllOf,
    nsfw: buildNSFWFilter(res, req.query.nsfw),
    filter: req.query.filter as VideoFilter,
    withFiles: false,
    user: res.locals.oauth ? res.locals.oauth.token.User : undefined
  })

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function removeVideo (req: express.Request, res: express.Response) {
  const videoInstance: VideoModel = res.locals.video

  await sequelizeTypescript.transaction(async t => {
    await videoInstance.destroy({ transaction: t })
  })

  auditLogger.delete(getAuditIdFromRes(res), new VideoAuditView(videoInstance.toFormattedDetailsJSON()))
  logger.info('Video with name %s and uuid %s deleted.', videoInstance.name, videoInstance.uuid)

  return res.type('json').status(204).end()
}
