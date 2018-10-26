import * as express from 'express'
import { ResultList } from '../../../../shared/models'
import { VideoCommentCreate } from '../../../../shared/models/videos/video-comment.model'
import { logger } from '../../../helpers/logger'
import { getFormattedObjects } from '../../../helpers/utils'
import { sequelizeTypescript } from '../../../initializers'
import { buildFormattedCommentTree, createVideoComment } from '../../../lib/video-comment'
import {
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate, optionalAuthenticate,
  paginationValidator,
  setDefaultPagination,
  setDefaultSort
} from '../../../middlewares'
import {
  addVideoCommentReplyValidator,
  addVideoCommentThreadValidator,
  listVideoCommentThreadsValidator,
  listVideoThreadCommentsValidator,
  removeVideoCommentValidator,
  videoCommentThreadsSortValidator
} from '../../../middlewares/validators'
import { VideoModel } from '../../../models/video/video'
import { VideoCommentModel } from '../../../models/video/video-comment'
import { auditLoggerFactory, CommentAuditView, getAuditIdFromRes } from '../../../helpers/audit-logger'
import { AccountModel } from '../../../models/account/account'
import { UserModel } from '../../../models/account/user'

const auditLogger = auditLoggerFactory('comments')

/**
 * @swagger
 *
 * components:
 *   schemas:
 *     VideoComment:
 *       properties:
 *         id:
 *           type: number
 *         url:
 *           type: string
 *         text:
 *           type: string
 *         threadId:
 *           type: number
 *         inReplyToCommentId:
 *           type: number
 *         videoId:
 *           type: number
 *         createdAt:
 *           type: string
 *         updatedAt:
 *           type: string
 *         totalReplies:
 *           type: number
 *         account:
 *           $ref: "#/components/schemas/Account"
 *     VideoCommentThreadTree:
 *       properties:
 *         comment:
 *           $ref: "#/components/schemas/VideoComment"
 *         children:
 *           type: array
 *           items:
 *             $ref: "#/components/schemas/VideoCommentThreadTree"
 */

const videoCommentRouter = express.Router()

/**
 * @swagger
 *
 * "/videos/{id}/comment-threads":
 *   get:
 *     tags:
 *       - VideoComment
 *     parameters:
 *       - $ref: "videos.yaml#/parameters/id"
 *       - $ref: "commons.yaml#/parameters/start"
 *       - $ref: "commons.yaml#/parameters/count"
 *       - $ref: "commons.yaml#/parameters/sort"
 *     responses:
 *       '200':
 *         description: successful operation
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "commons.yaml#/responses/CommentThreadResponse"
 */
videoCommentRouter.get('/:videoId/comment-threads',
  paginationValidator,
  videoCommentThreadsSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(listVideoCommentThreadsValidator),
  optionalAuthenticate,
  asyncMiddleware(listVideoThreads)
)

/**
 * @swagger
 *
 * "/videos/{id}/comment-threads/{threadId}":
 *   get:
 *     tags:
 *       - VideoComment
 *     parameters:
 *       - $ref: "videos.yaml#/parameters/id"
 *       - $ref: "video-comments.yaml#/parameters/threadId"
 *     responses:
 *       '200':
 *         description: successful operation
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "commons.yaml#/responses/VideoCommentThreadTree"
 */
videoCommentRouter.get('/:videoId/comment-threads/:threadId',
  asyncMiddleware(listVideoThreadCommentsValidator),
  optionalAuthenticate,
  asyncMiddleware(listVideoThreadComments)
)

/**
 * @swagger
 *
 * "/videos/{id}/comment-threads":
 *   post:
 *     security:
 *       - OAuth2: [ ]
 *     tags:
 *       - VideoComment
 *     parameters:
 *       - $ref: "videos.yaml#/parameters/id"
 *     responses:
 *       '200':
 *         description: successful operation
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "commons.yaml#/responses/CommentThreadPostResponse"
 */
videoCommentRouter.post('/:videoId/comment-threads',
  authenticate,
  asyncMiddleware(addVideoCommentThreadValidator),
  asyncRetryTransactionMiddleware(addVideoCommentThread)
)

/**
 * @swagger
 *
 * "/videos/{id}/comments/{commentId}":
 *   post:
 *     security:
 *       - OAuth2: [ ]
 *     tags:
 *       - VideoComment
 *     parameters:
 *       - $ref: "videos.yaml#/parameters/id"
 *       - $ref: "video-comments.yaml#/parameters/commentId"
 *     responses:
 *       '200':
 *         description: successful operation
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "commons.yaml#/responses/CommentThreadPostResponse"
 */
videoCommentRouter.post('/:videoId/comments/:commentId',
  authenticate,
  asyncMiddleware(addVideoCommentReplyValidator),
  asyncRetryTransactionMiddleware(addVideoCommentReply)
)

/**
 * @swagger
 *
 * "/videos/{id}/comments/{commentId}":
 *   delete:
 *     security:
 *       - OAuth2: [ ]
 *     tags:
 *       - VideoComment
 *     parameters:
 *       - $ref: "videos.yaml#/parameters/id"
 *       - $ref: "video-comments.yaml#/parameters/commentId"
 *     responses:
 *       '204':
 *         $ref: "commons.yaml#/responses/emptySuccess"
 */
videoCommentRouter.delete('/:videoId/comments/:commentId',
  authenticate,
  asyncMiddleware(removeVideoCommentValidator),
  asyncRetryTransactionMiddleware(removeVideoComment)
)

// ---------------------------------------------------------------------------

export {
  videoCommentRouter
}

// ---------------------------------------------------------------------------

async function listVideoThreads (req: express.Request, res: express.Response, next: express.NextFunction) {
  const video = res.locals.video as VideoModel
  const user: UserModel = res.locals.oauth ? res.locals.oauth.token.User : undefined

  let resultList: ResultList<VideoCommentModel>

  if (video.commentsEnabled === true) {
    resultList = await VideoCommentModel.listThreadsForApi(video.id, req.query.start, req.query.count, req.query.sort, user)
  } else {
    resultList = {
      total: 0,
      data: []
    }
  }

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function listVideoThreadComments (req: express.Request, res: express.Response, next: express.NextFunction) {
  const video = res.locals.video as VideoModel
  const user: UserModel = res.locals.oauth ? res.locals.oauth.token.User : undefined

  let resultList: ResultList<VideoCommentModel>

  if (video.commentsEnabled === true) {
    resultList = await VideoCommentModel.listThreadCommentsForApi(video.id, res.locals.videoCommentThread.id, user)
  } else {
    resultList = {
      total: 0,
      data: []
    }
  }

  return res.json(buildFormattedCommentTree(resultList))
}

async function addVideoCommentThread (req: express.Request, res: express.Response) {
  const videoCommentInfo: VideoCommentCreate = req.body

  const comment = await sequelizeTypescript.transaction(async t => {
    const account = await AccountModel.load((res.locals.oauth.token.User as UserModel).Account.id, t)

    return createVideoComment({
      text: videoCommentInfo.text,
      inReplyToComment: null,
      video: res.locals.video,
      account
    }, t)
  })

  auditLogger.create(getAuditIdFromRes(res), new CommentAuditView(comment.toFormattedJSON()))

  return res.json({
    comment: comment.toFormattedJSON()
  }).end()
}

async function addVideoCommentReply (req: express.Request, res: express.Response) {
  const videoCommentInfo: VideoCommentCreate = req.body

  const comment = await sequelizeTypescript.transaction(async t => {
    const account = await AccountModel.load((res.locals.oauth.token.User as UserModel).Account.id, t)

    return createVideoComment({
      text: videoCommentInfo.text,
      inReplyToComment: res.locals.videoComment,
      video: res.locals.video,
      account
    }, t)
  })

  auditLogger.create(getAuditIdFromRes(res), new CommentAuditView(comment.toFormattedJSON()))

  return res.json({ comment: comment.toFormattedJSON() }).end()
}

async function removeVideoComment (req: express.Request, res: express.Response) {
  const videoCommentInstance: VideoCommentModel = res.locals.videoComment

  await sequelizeTypescript.transaction(async t => {
    await videoCommentInstance.destroy({ transaction: t })
  })

  auditLogger.delete(
    getAuditIdFromRes(res),
    new CommentAuditView(videoCommentInstance.toFormattedJSON())
  )
  logger.info('Video comment %d deleted.', videoCommentInstance.id)

  return res.type('json').status(204).end()
}
