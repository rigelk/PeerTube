import * as express from 'express'
import * as RateLimit from 'express-rate-limit'
import { UserCreate, UserRight, UserRole, UserUpdate } from '../../../../shared'
import { logger } from '../../../helpers/logger'
import { getFormattedObjects } from '../../../helpers/utils'
import { CONFIG, RATES_LIMIT, sequelizeTypescript } from '../../../initializers'
import { Emailer } from '../../../lib/emailer'
import { Redis } from '../../../lib/redis'
import { createUserAccountAndChannel } from '../../../lib/user'
import {
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  ensureUserHasRight,
  ensureUserRegistrationAllowed,
  ensureUserRegistrationAllowedForIP,
  paginationValidator,
  setDefaultPagination,
  setDefaultSort,
  token,
  userAutocompleteValidator,
  usersAddValidator,
  usersGetValidator,
  usersRegisterValidator,
  usersRemoveValidator,
  usersSortValidator,
  usersUpdateValidator
} from '../../../middlewares'
import {
  usersAskResetPasswordValidator,
  usersAskSendVerifyEmailValidator,
  usersBlockingValidator,
  usersResetPasswordValidator,
  usersVerifyEmailValidator
} from '../../../middlewares/validators'
import { UserModel } from '../../../models/account/user'
import { auditLoggerFactory, getAuditIdFromRes, UserAuditView } from '../../../helpers/audit-logger'
import { meRouter } from './me'
import { deleteUserToken } from '../../../lib/oauth-model'
import { myBlocklistRouter } from './my-blocklist'

const auditLogger = auditLoggerFactory('users')

const loginRateLimiter = new RateLimit({
  windowMs: RATES_LIMIT.LOGIN.WINDOW_MS,
  max: RATES_LIMIT.LOGIN.MAX,
  delayMs: 0
})

const askSendEmailLimiter = new RateLimit({
  windowMs: RATES_LIMIT.ASK_SEND_EMAIL.WINDOW_MS,
  max: RATES_LIMIT.ASK_SEND_EMAIL.MAX,
  delayMs: 0
})

/**
 * @swagger
 *
 * components:
 *   schemas:
 *     User:
 *       properties:
 *         id:
 *           type: number
 *         username:
 *           type: string
 *         email:
 *           type: string
 *         displayNSFW:
 *           type: boolean
 *         autoPlayVideo:
 *           type: boolean
 *         role:
 *           type: string
 *           enum: [User, Moderator, Administrator]
 *         videoQuota:
 *           type: number
 *         createdAt:
 *           type: string
 *         account:
 *           $ref: "#/components/schemas/Account"
 *         videoChannels:
 *           type:  array
 *           items:
 *             $ref: "#/components/schemas/VideoChannel"
 *     AddUser:
 *       properties:
 *         username:
 *           type: string
 *           description: 'The user username '
 *         password:
 *           type: string
 *           description: 'The user password '
 *         email:
 *           type: string
 *           description: 'The user email '
 *         videoQuota:
 *           type: string
 *           description: 'The user videoQuota '
 *         role:
 *           type: string
 *           description: 'The user role '
 *       required:
 *         - username
 *         - password
 *         - email
 *         - videoQuota
 *         - role
 *     UpdateUser:
 *       properties:
 *         id:
 *           type: string
 *           description: 'The user id '
 *         email:
 *           type: string
 *           description: 'The updated email of the user '
 *         videoQuota:
 *           type: string
 *           description: 'The updated videoQuota of the user '
 *         role:
 *           type: string
 *           description: 'The updated role of the user '
 *       required:
 *         - id
 *         - email
 *         - videoQuota
 *         - role
 *     RegisterUser:
 *       properties:
 *         username:
 *           type: string
 *           description: 'The username of the user '
 *         password:
 *           type: string
 *           description: 'The password of the user '
 *         email:
 *           type: string
 *           description: 'The email of the user '
 *       required:
 *         - username
 *         - password
 *         - email
 */

const usersRouter = express.Router()
usersRouter.use('/', myBlocklistRouter)
usersRouter.use('/', meRouter)

/**
 * @todo write swagger definition
 */
usersRouter.get('/autocomplete',
  userAutocompleteValidator,
  asyncMiddleware(autocompleteUsers)
)

/**
 * @swagger
 *
 * /users:
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
 *                 $ref: '#/components/schemas/User'
 */
usersRouter.get('/',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_USERS),
  paginationValidator,
  usersSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(listUsers)
)

/**
 * @todo write swagger definition
 */
usersRouter.post('/:id/block',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_USERS),
  asyncMiddleware(usersBlockingValidator),
  asyncMiddleware(blockUser)
)

/**
 * @todo write swagger definition
 */
usersRouter.post('/:id/unblock',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_USERS),
  asyncMiddleware(usersBlockingValidator),
  asyncMiddleware(unblockUser)
)

/**
 * @swagger
 *
 * '/users/{id}':
 *   get:
 *     security:
 *       - OAuth2: [ ]
 *     tags:
 *       - User
 *     parameters:
 *       - $ref: "users.yaml#/parameters/id"
 *     responses:
 *       '200':
 *         description: successful operation
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 */
usersRouter.get('/:id',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_USERS),
  asyncMiddleware(usersGetValidator),
  getUser
)

/**
 * @swagger
 *
 * /users:
 *   post:
 *     security:
 *       - OAuth2: [ ]
 *     tags:
 *       - User
 *     requestBody:
 *       application/json:
 *         required: true
 *         description: 'User to create'
 *         schema:
 *           $ref: '#/components/schemas/AddUser'
 *     responses:
 *       '200':
 *         description: successful operation
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "commons.yaml#/responses/AddUserResponse"
 */
usersRouter.post('/',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_USERS),
  asyncMiddleware(usersAddValidator),
  asyncRetryTransactionMiddleware(createUser)
)

/**
 * @swagger
 *
 * /users/register:
 *   post:
 *     tags:
 *       - User
 *     requestBody:
 *       application/json:
 *         required: true
 *         schema:
 *           $ref: '#/components/schemas/RegisterUser'
 *     responses:
 *       '204':
 *         $ref: "commons.yaml#/responses/emptySuccess"
 */
usersRouter.post('/register',
  asyncMiddleware(ensureUserRegistrationAllowed),
  ensureUserRegistrationAllowedForIP,
  asyncMiddleware(usersRegisterValidator),
  asyncRetryTransactionMiddleware(registerUser)
)

/**
 * @swagger
 *
 * '/users/{id}':
 *   put:
 *     security:
 *       - OAuth2: [ ]
 *     tags:
 *       - User
 *     parameters:
 *       - $ref: "users.yaml#/parameters/id"
 *     requestBody:
 *       application/json:
 *         required: true
 *         schema:
 *           $ref: '#/components/schemas/UpdateUser'
 *     responses:
 *       '204':
 *         $ref: "commons.yaml#/responses/emptySuccess"
 */
usersRouter.put('/:id',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_USERS),
  asyncMiddleware(usersUpdateValidator),
  asyncMiddleware(updateUser)
)

/**
 * @swagger
 *
 * '/users/{id}':
 *   delete:
 *     security:
 *       - OAuth2: [ ]
 *     tags:
 *       - User
 *     parameters:
 *       - $ref: "users.yaml#/parameters/id"
 *     responses:
 *       '204':
 *         $ref: "commons.yaml#/responses/emptySuccess"
 */
usersRouter.delete('/:id',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_USERS),
  asyncMiddleware(usersRemoveValidator),
  asyncMiddleware(removeUser)
)

/**
 * @todo write swagger definition
 */
usersRouter.post('/ask-reset-password',
  asyncMiddleware(usersAskResetPasswordValidator),
  asyncMiddleware(askResetUserPassword)
)

/**
 * @todo write swagger definition
 */
usersRouter.post('/:id/reset-password',
  asyncMiddleware(usersResetPasswordValidator),
  asyncMiddleware(resetUserPassword)
)

/**
 * @todo write swagger definition
 */
usersRouter.post('/ask-send-verify-email',
  askSendEmailLimiter,
  asyncMiddleware(usersAskSendVerifyEmailValidator),
  asyncMiddleware(askSendVerifyUserEmail)
)

/**
 * @todo write swagger definition
 */
usersRouter.post('/:id/verify-email',
  asyncMiddleware(usersVerifyEmailValidator),
  asyncMiddleware(verifyUserEmail)
)

/**
 * @todo write swagger definition
 */
usersRouter.post('/token',
  loginRateLimiter,
  token,
  success
)
// TODO: Once https://github.com/oauthjs/node-oauth2-server/pull/289 is merged, implement revoke token route

// ---------------------------------------------------------------------------

export {
  usersRouter
}

// ---------------------------------------------------------------------------

async function createUser (req: express.Request, res: express.Response) {
  const body: UserCreate = req.body
  const userToCreate = new UserModel({
    username: body.username,
    password: body.password,
    email: body.email,
    nsfwPolicy: CONFIG.INSTANCE.DEFAULT_NSFW_POLICY,
    autoPlayVideo: true,
    role: body.role,
    videoQuota: body.videoQuota,
    videoQuotaDaily: body.videoQuotaDaily
  })

  const { user, account } = await createUserAccountAndChannel(userToCreate)

  auditLogger.create(getAuditIdFromRes(res), new UserAuditView(user.toFormattedJSON()))
  logger.info('User %s with its channel and account created.', body.username)

  return res.json({
    user: {
      id: user.id,
      account: {
        id: account.id,
        uuid: account.Actor.uuid
      }
    }
  }).end()
}

async function registerUser (req: express.Request, res: express.Response) {
  const body: UserCreate = req.body

  const userToCreate = new UserModel({
    username: body.username,
    password: body.password,
    email: body.email,
    nsfwPolicy: CONFIG.INSTANCE.DEFAULT_NSFW_POLICY,
    autoPlayVideo: true,
    role: UserRole.USER,
    videoQuota: CONFIG.USER.VIDEO_QUOTA,
    videoQuotaDaily: CONFIG.USER.VIDEO_QUOTA_DAILY,
    emailVerified: CONFIG.SIGNUP.REQUIRES_EMAIL_VERIFICATION ? false : null
  })

  const { user } = await createUserAccountAndChannel(userToCreate)

  auditLogger.create(body.username, new UserAuditView(user.toFormattedJSON()))
  logger.info('User %s with its channel and account registered.', body.username)

  if (CONFIG.SIGNUP.REQUIRES_EMAIL_VERIFICATION) {
    await sendVerifyUserEmail(user)
  }

  return res.type('json').status(204).end()
}

async function unblockUser (req: express.Request, res: express.Response, next: express.NextFunction) {
  const user: UserModel = res.locals.user

  await changeUserBlock(res, user, false)

  return res.status(204).end()
}

async function blockUser (req: express.Request, res: express.Response, next: express.NextFunction) {
  const user: UserModel = res.locals.user
  const reason = req.body.reason

  await changeUserBlock(res, user, true, reason)

  return res.status(204).end()
}

function getUser (req: express.Request, res: express.Response, next: express.NextFunction) {
  return res.json((res.locals.user as UserModel).toFormattedJSON())
}

async function autocompleteUsers (req: express.Request, res: express.Response, next: express.NextFunction) {
  const resultList = await UserModel.autoComplete(req.query.search as string)

  return res.json(resultList)
}

async function listUsers (req: express.Request, res: express.Response, next: express.NextFunction) {
  const resultList = await UserModel.listForApi(req.query.start, req.query.count, req.query.sort, req.query.search)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function removeUser (req: express.Request, res: express.Response, next: express.NextFunction) {
  const user: UserModel = res.locals.user

  await user.destroy()

  auditLogger.delete(getAuditIdFromRes(res), new UserAuditView(user.toFormattedJSON()))

  return res.sendStatus(204)
}

async function updateUser (req: express.Request, res: express.Response, next: express.NextFunction) {
  const body: UserUpdate = req.body
  const userToUpdate = res.locals.user as UserModel
  const oldUserAuditView = new UserAuditView(userToUpdate.toFormattedJSON())
  const roleChanged = body.role !== undefined && body.role !== userToUpdate.role

  if (body.email !== undefined) userToUpdate.email = body.email
  if (body.videoQuota !== undefined) userToUpdate.videoQuota = body.videoQuota
  if (body.videoQuotaDaily !== undefined) userToUpdate.videoQuotaDaily = body.videoQuotaDaily
  if (body.role !== undefined) userToUpdate.role = body.role

  const user = await userToUpdate.save()

  // Destroy user token to refresh rights
  if (roleChanged) await deleteUserToken(userToUpdate.id)

  auditLogger.update(getAuditIdFromRes(res), new UserAuditView(user.toFormattedJSON()), oldUserAuditView)

  // Don't need to send this update to followers, these attributes are not propagated

  return res.sendStatus(204)
}

async function askResetUserPassword (req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = res.locals.user as UserModel

  const verificationString = await Redis.Instance.setResetPasswordVerificationString(user.id)
  const url = CONFIG.WEBSERVER.URL + '/reset-password?userId=' + user.id + '&verificationString=' + verificationString
  await Emailer.Instance.addForgetPasswordEmailJob(user.email, url)

  return res.status(204).end()
}

async function resetUserPassword (req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = res.locals.user as UserModel
  user.password = req.body.password

  await user.save()

  return res.status(204).end()
}

async function sendVerifyUserEmail (user: UserModel) {
  const verificationString = await Redis.Instance.setVerifyEmailVerificationString(user.id)
  const url = CONFIG.WEBSERVER.URL + '/verify-account/email?userId=' + user.id + '&verificationString=' + verificationString
  await Emailer.Instance.addVerifyEmailJob(user.email, url)
  return
}

async function askSendVerifyUserEmail (req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = res.locals.user as UserModel

  await sendVerifyUserEmail(user)

  return res.status(204).end()
}

async function verifyUserEmail (req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = res.locals.user as UserModel
  user.emailVerified = true

  await user.save()

  return res.status(204).end()
}

function success (req: express.Request, res: express.Response, next: express.NextFunction) {
  res.end()
}

async function changeUserBlock (res: express.Response, user: UserModel, block: boolean, reason?: string) {
  const oldUserAuditView = new UserAuditView(user.toFormattedJSON())

  user.blocked = block
  user.blockedReason = reason || null

  await sequelizeTypescript.transaction(async t => {
    await deleteUserToken(user.id, t)

    await user.save({ transaction: t })
  })

  await Emailer.Instance.addUserBlockJob(user, block, reason)

  auditLogger.update(getAuditIdFromRes(res), new UserAuditView(user.toFormattedJSON()), oldUserAuditView)
}
