import * as express from 'express'
import 'multer'
import { UserUpdateMe, UserVideoRate as FormattedUserVideoRate } from '../../../../shared'
import { getFormattedObjects } from '../../../helpers/utils'
import { CONFIG, IMAGE_MIMETYPE_EXT, sequelizeTypescript } from '../../../initializers'
import { sendUpdateActor } from '../../../lib/activitypub/send'
import {
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  commonVideosFiltersValidator,
  paginationValidator,
  setDefaultPagination,
  setDefaultSort,
  userSubscriptionAddValidator,
  userSubscriptionGetValidator,
  usersUpdateMeValidator,
  usersVideoRatingValidator
} from '../../../middlewares'
import {
  areSubscriptionsExistValidator,
  deleteMeValidator,
  userSubscriptionsSortValidator,
  videoImportsSortValidator,
  videosSortValidator
} from '../../../middlewares/validators'
import { AccountVideoRateModel } from '../../../models/account/account-video-rate'
import { UserModel } from '../../../models/account/user'
import { VideoModel } from '../../../models/video/video'
import { VideoSortField } from '../../../../client/src/app/shared/video/sort-field.type'
import { buildNSFWFilter, createReqFiles } from '../../../helpers/express-utils'
import { UserVideoQuota } from '../../../../shared/models/users/user-video-quota.model'
import { updateAvatarValidator } from '../../../middlewares/validators/avatar'
import { updateActorAvatarFile } from '../../../lib/avatar'
import { auditLoggerFactory, getAuditIdFromRes, UserAuditView } from '../../../helpers/audit-logger'
import { VideoImportModel } from '../../../models/video/video-import'
import { VideoFilter } from '../../../../shared/models/videos/video-query.type'
import { ActorFollowModel } from '../../../models/activitypub/actor-follow'
import { JobQueue } from '../../../lib/job-queue'
import { logger } from '../../../helpers/logger'
import { AccountModel } from '../../../models/account/account'

const auditLogger = auditLoggerFactory('users-me')

const reqAvatarFile = createReqFiles([ 'avatarfile' ], IMAGE_MIMETYPE_EXT, { avatarfile: CONFIG.STORAGE.AVATARS_DIR })

/**
 * @swagger
 *
 * components:
 *   schemas:
 *     Avatar:
 *       properties:
 *         path:
 *           type: string
 *         createdAt:
 *           type: string
 *         updatedAt:
 *           type: string
 *     UpdateMe:
 *       properties:
 *         password:
 *           type: string
 *           description: 'Your new password '
 *         email:
 *           type: string
 *           description: 'Your new email '
 *         displayNSFW:
 *           type: string
 *           description: 'Your new displayNSFW '
 *         autoPlayVideo:
 *           type: string
 *           description: 'Your new autoPlayVideo '
 *       required:
 *         - password
 *         - email
 *         - displayNSFW
 *         - autoPlayVideo
 *     GetMeVideoRating:
 *       properties:
 *         id:
 *           type: string
 *           description: 'Id of the video '
 *         rating:
 *           type: number
 *           description: 'Rating of the video '
 *       required:
 *         - id
 *         - rating
 */

const meRouter = express.Router()

/**
 * @swagger
 *
 * /users/me:
 *   get:
 *     security:
 *       - OAuth2: [ ]
 *     tags:
 *       - User
 *     responses:
 *       '200':
 *         description: successful operation
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 */
meRouter.get('/me',
  authenticate,
  asyncMiddleware(getUserInformation)
)

/**
 * @todo write swagger definition
 */
meRouter.delete('/me',
  authenticate,
  asyncMiddleware(deleteMeValidator),
  asyncMiddleware(deleteMe)
)

/**
 * @swagger
 *
 * /users/me/video-quota-used:
 *   get:
 *     security:
 *       - OAuth2: [ ]
 *     tags:
 *       - User
 *     parameters: []
 *     responses:
 *       '200':
 *         description: successful operation
 *         content:
 *           application/json:
 *             schema:
 *               type: number
 */
meRouter.get('/me/video-quota-used',
  authenticate,
  asyncMiddleware(getUserVideoQuotaUsed)
)

/**
 * @todo write swagger definition
 */
meRouter.get('/me/videos/imports',
  authenticate,
  paginationValidator,
  videoImportsSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(getUserVideoImports)
)

/**
 * @swagger
 *
 * /users/me/videos:
 *   get:
 *     security:
 *       - OAuth2: [ ]
 *     tags:
 *       - User
 *     parameters:
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
meRouter.get('/me/videos',
  authenticate,
  paginationValidator,
  videosSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(getUserVideos)
)

/**
 * @swagger
 *
 * '/users/me/videos/{videoId}/rating':
 *   get:
 *     security:
 *       - OAuth2: [ ]
 *     tags:
 *       - User
 *     parameters:
 *       - name: videoId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: 'The video id '
 *     responses:
 *       '200':
 *         description: successful operation
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GetMeVideoRating'
 */
meRouter.get('/me/videos/:videoId/rating',
  authenticate,
  asyncMiddleware(usersVideoRatingValidator),
  asyncMiddleware(getUserVideoRating)
)

/**
 * @swagger
 *
 * /users/me:
 *   put:
 *     security:
 *       - OAuth2: [ ]
 *     tags:
 *       - User
 *     requestBody:
 *       application/json:
 *         required: true
 *         schema:
 *           $ref: '#/components/schemas/UpdateMe'
 *     responses:
 *       '204':
 *         $ref: "commons.yaml#/responses/emptySuccess"
 */
meRouter.put('/me',
  authenticate,
  asyncMiddleware(usersUpdateMeValidator),
  asyncRetryTransactionMiddleware(updateMe)
)

/**
 * @swagger
 *
 * /users/me/avatar/pick:
 *   post:
 *     security:
 *       - OAuth2: [ ]
 *     tags:
 *       - User
 *     requestBody:
 *       description: The file to upload.
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatarfile:
 *                 type: string
 *                 format: binary
 *     responses:
 *       '200':
 *         description: successful operation
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Avatar'
 */
meRouter.post('/me/avatar/pick',
  authenticate,
  reqAvatarFile,
  updateAvatarValidator,
  asyncRetryTransactionMiddleware(updateMyAvatar)
)

// ##### Subscriptions part #####

/**
 * @todo write swagger definition
 */
meRouter.get('/me/subscriptions/videos',
  authenticate,
  paginationValidator,
  videosSortValidator,
  setDefaultSort,
  setDefaultPagination,
  commonVideosFiltersValidator,
  asyncMiddleware(getUserSubscriptionVideos)
)

/**
 * @todo write swagger definition
 */
meRouter.get('/me/subscriptions/exist',
  authenticate,
  areSubscriptionsExistValidator,
  asyncMiddleware(areSubscriptionsExist)
)

/**
 * @todo write swagger definition
 */
meRouter.get('/me/subscriptions',
  authenticate,
  paginationValidator,
  userSubscriptionsSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(getUserSubscriptions)
)

/**
 * @todo write swagger definition
 */
meRouter.post('/me/subscriptions',
  authenticate,
  userSubscriptionAddValidator,
  asyncMiddleware(addUserSubscription)
)

/**
 * @todo write swagger definition
 */
meRouter.get('/me/subscriptions/:uri',
  authenticate,
  userSubscriptionGetValidator,
  getUserSubscription
)

/**
 * @todo write swagger definition
 */
meRouter.delete('/me/subscriptions/:uri',
  authenticate,
  userSubscriptionGetValidator,
  asyncRetryTransactionMiddleware(deleteUserSubscription)
)

// ---------------------------------------------------------------------------

export {
  meRouter
}

// ---------------------------------------------------------------------------

async function areSubscriptionsExist (req: express.Request, res: express.Response) {
  const uris = req.query.uris as string[]
  const user = res.locals.oauth.token.User as UserModel

  const handles = uris.map(u => {
    let [ name, host ] = u.split('@')
    if (host === CONFIG.WEBSERVER.HOST) host = null

    return { name, host, uri: u }
  })

  const results = await ActorFollowModel.listSubscribedIn(user.Account.Actor.id, handles)

  const existObject: { [id: string ]: boolean } = {}
  for (const handle of handles) {
    const obj = results.find(r => {
      const server = r.ActorFollowing.Server

      return r.ActorFollowing.preferredUsername === handle.name &&
        (
          (!server && !handle.host) ||
          (server.host === handle.host)
        )
    })

    existObject[handle.uri] = obj !== undefined
  }

  return res.json(existObject)
}

async function addUserSubscription (req: express.Request, res: express.Response) {
  const user = res.locals.oauth.token.User as UserModel
  const [ name, host ] = req.body.uri.split('@')

  const payload = {
    name,
    host,
    followerActorId: user.Account.Actor.id
  }

  JobQueue.Instance.createJob({ type: 'activitypub-follow', payload })
          .catch(err => logger.error('Cannot create follow job for subscription %s.', req.body.uri, err))

  return res.status(204).end()
}

function getUserSubscription (req: express.Request, res: express.Response) {
  const subscription: ActorFollowModel = res.locals.subscription

  return res.json(subscription.ActorFollowing.VideoChannel.toFormattedJSON())
}

async function deleteUserSubscription (req: express.Request, res: express.Response) {
  const subscription: ActorFollowModel = res.locals.subscription

  await sequelizeTypescript.transaction(async t => {
    return subscription.destroy({ transaction: t })
  })

  return res.type('json').status(204).end()
}

async function getUserSubscriptions (req: express.Request, res: express.Response) {
  const user = res.locals.oauth.token.User as UserModel
  const actorId = user.Account.Actor.id

  const resultList = await ActorFollowModel.listSubscriptionsForApi(actorId, req.query.start, req.query.count, req.query.sort)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function getUserSubscriptionVideos (req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = res.locals.oauth.token.User as UserModel
  const resultList = await VideoModel.listForApi({
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort,
    includeLocalVideos: false,
    categoryOneOf: req.query.categoryOneOf,
    licenceOneOf: req.query.licenceOneOf,
    languageOneOf: req.query.languageOneOf,
    tagsOneOf: req.query.tagsOneOf,
    tagsAllOf: req.query.tagsAllOf,
    nsfw: buildNSFWFilter(res, req.query.nsfw),
    filter: req.query.filter as VideoFilter,
    withFiles: false,
    actorId: user.Account.Actor.id,
    user
  })

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function getUserVideos (req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = res.locals.oauth.token.User as UserModel
  const resultList = await VideoModel.listUserVideosForApi(
    user.Account.id,
    req.query.start as number,
    req.query.count as number,
    req.query.sort as VideoSortField
  )

  const additionalAttributes = {
    waitTranscoding: true,
    state: true,
    scheduledUpdate: true,
    blacklistInfo: true
  }
  return res.json(getFormattedObjects(resultList.data, resultList.total, { additionalAttributes }))
}

async function getUserVideoImports (req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = res.locals.oauth.token.User as UserModel
  const resultList = await VideoImportModel.listUserVideoImportsForApi(
    user.id,
    req.query.start as number,
    req.query.count as number,
    req.query.sort
  )

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function getUserInformation (req: express.Request, res: express.Response, next: express.NextFunction) {
  // We did not load channels in res.locals.user
  const user = await UserModel.loadByUsernameAndPopulateChannels(res.locals.oauth.token.user.username)

  return res.json(user.toFormattedJSON())
}

async function getUserVideoQuotaUsed (req: express.Request, res: express.Response, next: express.NextFunction) {
  // We did not load channels in res.locals.user
  const user = await UserModel.loadByUsernameAndPopulateChannels(res.locals.oauth.token.user.username)
  const videoQuotaUsed = await UserModel.getOriginalVideoFileTotalFromUser(user)
  const videoQuotaUsedDaily = await UserModel.getOriginalVideoFileTotalDailyFromUser(user)

  const data: UserVideoQuota = {
    videoQuotaUsed,
    videoQuotaUsedDaily
  }
  return res.json(data)
}

async function getUserVideoRating (req: express.Request, res: express.Response, next: express.NextFunction) {
  const videoId = res.locals.video.id
  const accountId = +res.locals.oauth.token.User.Account.id

  const ratingObj = await AccountVideoRateModel.load(accountId, videoId, null)
  const rating = ratingObj ? ratingObj.type : 'none'

  const json: FormattedUserVideoRate = {
    videoId,
    rating
  }
  return res.json(json)
}

async function deleteMe (req: express.Request, res: express.Response) {
  const user: UserModel = res.locals.oauth.token.User

  await user.destroy()

  auditLogger.delete(getAuditIdFromRes(res), new UserAuditView(user.toFormattedJSON()))

  return res.sendStatus(204)
}

async function updateMe (req: express.Request, res: express.Response, next: express.NextFunction) {
  const body: UserUpdateMe = req.body

  const user: UserModel = res.locals.oauth.token.user
  const oldUserAuditView = new UserAuditView(user.toFormattedJSON())

  if (body.password !== undefined) user.password = body.password
  if (body.email !== undefined) user.email = body.email
  if (body.nsfwPolicy !== undefined) user.nsfwPolicy = body.nsfwPolicy
  if (body.webTorrentEnabled !== undefined) user.webTorrentEnabled = body.webTorrentEnabled
  if (body.autoPlayVideo !== undefined) user.autoPlayVideo = body.autoPlayVideo

  await sequelizeTypescript.transaction(async t => {
    const userAccount = await AccountModel.load(user.Account.id)

    await user.save({ transaction: t })

    if (body.displayName !== undefined) userAccount.name = body.displayName
    if (body.description !== undefined) userAccount.description = body.description
    await userAccount.save({ transaction: t })

    await sendUpdateActor(userAccount, t)

    auditLogger.update(getAuditIdFromRes(res), new UserAuditView(user.toFormattedJSON()), oldUserAuditView)
  })

  return res.sendStatus(204)
}

async function updateMyAvatar (req: express.Request, res: express.Response, next: express.NextFunction) {
  const avatarPhysicalFile = req.files[ 'avatarfile' ][ 0 ]
  const user: UserModel = res.locals.oauth.token.user
  const oldUserAuditView = new UserAuditView(user.toFormattedJSON())

  const userAccount = await AccountModel.load(user.Account.id)

  const avatar = await updateActorAvatarFile(avatarPhysicalFile, userAccount)

  auditLogger.update(getAuditIdFromRes(res), new UserAuditView(user.toFormattedJSON()), oldUserAuditView)

  return res.json({ avatar: avatar.toFormattedJSON() })
}
