import * as express from 'express'
import { getFormattedObjects } from '../../helpers/utils'
import {
  asyncMiddleware,
  commonVideosFiltersValidator,
  listVideoAccountChannelsValidator,
  optionalAuthenticate,
  paginationValidator,
  setDefaultPagination,
  setDefaultSort
} from '../../middlewares'
import { accountsNameWithHostGetValidator, accountsSortValidator, videosSortValidator } from '../../middlewares/validators'
import { AccountModel } from '../../models/account/account'
import { VideoModel } from '../../models/video/video'
import { buildNSFWFilter, isUserAbleToSearchRemoteURI } from '../../helpers/express-utils'
import { VideoChannelModel } from '../../models/video/video-channel'

/**
 * @swagger
 *
 * components:
 *   schemas:
 *     Actor:
 *       properties:
 *         id:
 *           type: number
 *         uuid:
 *           type: string
 *         url:
 *           type: string
 *         name:
 *           type: string
 *         host:
 *           type: string
 *         followingCount:
 *           type: number
 *         followersCount:
 *           type: number
 *         createdAt:
 *           type: string
 *         updatedAt:
 *           type: string
 *         avatar:
 *           $ref: "#/components/schemas/Avatar"
 *     Account:
 *       allOf:
 *         - $ref: "#/components/schemas/Actor"
 *         - properties:
 *             displayName:
 *               type: string
 */

const accountsRouter = express.Router()

/**
 * @swagger
 *
 * /accounts:
 *   get:
 *     operationId: getAccounts
 *     summary: Gets all accounts
 *     tags:
 *       - Accounts
 *     responses:
 *       '200':
 *         description: successful operation
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Account'
 */
accountsRouter.get('/',
  paginationValidator,
  accountsSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(listAccounts)
)

/**
 * @swagger
 *
 * '/accounts/{name}':
 *   get:
 *     operationId: getAccountByName
 *     summary: Gets the account by name
 *     tags:
 *       - Accounts
 *     parameters:
 *       - $ref: "accounts.yaml#/parameters/name"
 *       - $ref: "commons.yaml#/parameters/start"
 *       - $ref: "commons.yaml#/parameters/count"
 *       - $ref: "commons.yaml#/parameters/sort"
 *     responses:
 *       '200':
 *         description: successful operation
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Account'
 */
accountsRouter.get('/:accountName',
  asyncMiddleware(accountsNameWithHostGetValidator),
  getAccount
)

/**
 * @swagger
 *
 * '/accounts/{name}/videos':
 *   get:
 *     operationId: getAccountByNameVideos
 *     summary: Gets videos for an account, provided the name of that account
 *     tags:
 *       - Accounts
 *     parameters:
 *       - $ref: "accounts.yaml#/parameters/name"
 *     responses:
 *       '200':
 *         description: successful operation
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Video'
 */
accountsRouter.get('/:accountName/videos',
  asyncMiddleware(accountsNameWithHostGetValidator),
  paginationValidator,
  videosSortValidator,
  setDefaultSort,
  setDefaultPagination,
  optionalAuthenticate,
  commonVideosFiltersValidator,
  asyncMiddleware(listAccountVideos)
)

/**
 * @todo write swagger definition
 */
accountsRouter.get('/:accountName/video-channels',
  asyncMiddleware(listVideoAccountChannelsValidator),
  asyncMiddleware(listVideoAccountChannels)
)

// ---------------------------------------------------------------------------

export {
  accountsRouter
}

// ---------------------------------------------------------------------------

function getAccount (req: express.Request, res: express.Response, next: express.NextFunction) {
  const account: AccountModel = res.locals.account

  return res.json(account.toFormattedJSON())
}

async function listAccounts (req: express.Request, res: express.Response, next: express.NextFunction) {
  const resultList = await AccountModel.listForApi(req.query.start, req.query.count, req.query.sort)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function listVideoAccountChannels (req: express.Request, res: express.Response, next: express.NextFunction) {
  const resultList = await VideoChannelModel.listByAccount(res.locals.account.id)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function listAccountVideos (req: express.Request, res: express.Response, next: express.NextFunction) {
  const account: AccountModel = res.locals.account
  const actorId = isUserAbleToSearchRemoteURI(res) ? null : undefined

  const resultList = await VideoModel.listForApi({
    actorId,
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort,
    includeLocalVideos: true,
    categoryOneOf: req.query.categoryOneOf,
    licenceOneOf: req.query.licenceOneOf,
    languageOneOf: req.query.languageOneOf,
    tagsOneOf: req.query.tagsOneOf,
    tagsAllOf: req.query.tagsAllOf,
    filter: req.query.filter,
    nsfw: buildNSFWFilter(res, req.query.nsfw),
    withFiles: false,
    accountId: account.id,
    user: res.locals.oauth ? res.locals.oauth.token.User : undefined
  })

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}
