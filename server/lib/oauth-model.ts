import * as Bluebird from 'bluebird'
import { AccessDeniedError } from 'oauth2-server'
import { logger } from '../helpers/logger'
import { UserModel } from '../models/account/user'
import { OAuthClientModel } from '../models/oauth/oauth-client'
import { OAuthTokenModel } from '../models/oauth/oauth-token'
import { LRU_CACHE, PEERTUBE_VERSION, WEBSERVER } from '../initializers/constants'
import { Transaction } from 'sequelize'
import { CONFIG } from '../initializers/config'
import * as LRUCache from 'lru-cache'
import { MOAuthTokenUser } from '@server/typings/models/oauth/oauth-token'
import fetch from 'node-fetch'
import { MUserDefault } from '@server/typings/models'
import { createUserAccountAndChannelAndPlaylist } from '../lib/user'
import { UserRole } from '../../shared'

type TokenInfo = { accessToken: string, refreshToken: string, accessTokenExpiresAt: Date, refreshTokenExpiresAt: Date }

const accessTokenCache = new LRUCache<string, MOAuthTokenUser>({ max: LRU_CACHE.USER_TOKENS.MAX_SIZE })
const userHavingToken = new LRUCache<number, string>({ max: LRU_CACHE.USER_TOKENS.MAX_SIZE })

// ---------------------------------------------------------------------------

function deleteUserToken (userId: number, t?: Transaction) {
  clearCacheByUserId(userId)

  return OAuthTokenModel.deleteUserToken(userId, t)
}

function clearCacheByUserId (userId: number) {
  const token = userHavingToken.get(userId)

  if (token !== undefined) {
    accessTokenCache.del(token)
    userHavingToken.del(userId)
  }
}

function clearCacheByToken (token: string) {
  const tokenModel = accessTokenCache.get(token)

  if (tokenModel !== undefined) {
    userHavingToken.del(tokenModel.userId)
    accessTokenCache.del(token)
  }
}

function getAccessToken (bearerToken: string) {
  logger.debug('Getting access token (bearerToken: ' + bearerToken + ').')

  if (!bearerToken) return Bluebird.resolve(undefined)

  if (accessTokenCache.has(bearerToken)) return Bluebird.resolve(accessTokenCache.get(bearerToken))

  return OAuthTokenModel.getByTokenAndPopulateUser(bearerToken)
    .then(tokenModel => {
      if (tokenModel) {
        accessTokenCache.set(bearerToken, tokenModel)
        userHavingToken.set(tokenModel.userId, tokenModel.accessToken)
      }

      return tokenModel
    })
}

function getClient (clientId: string, clientSecret: string) {
  logger.debug('Getting Client (clientId: ' + clientId + ', clientSecret: ' + clientSecret + ').')

  return OAuthClientModel.getByIdAndSecret(clientId, clientSecret)
}

function getRefreshToken (refreshToken: string) {
  logger.debug('Getting RefreshToken (refreshToken: ' + refreshToken + ').')

  return OAuthTokenModel.getByRefreshTokenAndPopulateClient(refreshToken)
}

async function getUserFirebase (usernameOrEmail: string, password: string, user?: MUserDefault) {
  const userResult = await fetch('https://us-central1-bittube-airtime-extension.cloudfunctions.net/verifyPassword', {
    headers: {
      'User-Agent': `PeerTube/${PEERTUBE_VERSION} (+${WEBSERVER.URL})`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email: usernameOrEmail, password }),
    method: 'POST'
  }).then(response => response.json())

  if (userResult.success && userResult.user && userResult.decodedIdToken) {
    const email = userResult.user.email
    const firebaseInfo = userResult.decodedIdToken.firebase

    if (firebaseInfo && firebaseInfo.identities && firebaseInfo.sign_in_provider) {
      if (['google.com', 'facebook.com', 'twitter.com'].indexOf(firebaseInfo.sign_in_provider) !== -1) {
        if (firebaseInfo.identities[firebaseInfo.sign_in_provider] && firebaseInfo.identities[firebaseInfo.sign_in_provider].length) {
          userResult.user.emailVerified = true
        }
      }
    }
    const emailVerified = userResult.user.emailVerified || false

    if (!user) {
      const userData = {
        username: usernameOrEmail.split('@')[0], // TODO: New username function.
        email,
        password,
        role: UserRole.USER,
        emailVerified: CONFIG.SIGNUP.REQUIRES_EMAIL_VERIFICATION ? emailVerified : null,
        nsfwPolicy: CONFIG.INSTANCE.DEFAULT_NSFW_POLICY,
        videoQuota: CONFIG.USER.VIDEO_QUOTA,
        videoQuotaDaily: CONFIG.USER.VIDEO_QUOTA_DAILY
      }

      const userToCreate = new UserModel(userData)
      const userCreationResult = await createUserAccountAndChannelAndPlaylist({
        userToCreate,
        userDisplayName: userResult.user.displayName || undefined
      })

      user = userCreationResult.user
    }

    if (user.blocked) throw new AccessDeniedError('User is blocked.')

    if (CONFIG.SIGNUP.REQUIRES_EMAIL_VERIFICATION && user.emailVerified === false) {
      throw new AccessDeniedError('User email is not verified.')
    }

    return user
  }
  return null
}

async function getUser (usernameOrEmail: string, password: string) {
  logger.debug('Getting User (username/email: ' + usernameOrEmail + ', password: ******).')

  const user = await UserModel.loadByUsernameOrEmail(usernameOrEmail)
  if (!user) return getUserFirebase(usernameOrEmail, password, null)

  const passwordMatch = await user.isPasswordMatch(password)
  if (passwordMatch === false) return getUserFirebase(usernameOrEmail, password, user)

  if (user.blocked) throw new AccessDeniedError('User is blocked.')

  if (CONFIG.SIGNUP.REQUIRES_EMAIL_VERIFICATION && user.emailVerified === false) {
    throw new AccessDeniedError('User email is not verified.')
  }

  return user
}

async function revokeToken (tokenInfo: TokenInfo) {
  const token = await OAuthTokenModel.getByRefreshTokenAndPopulateUser(tokenInfo.refreshToken)
  if (token) {
    clearCacheByToken(token.accessToken)

    token.destroy()
         .catch(err => logger.error('Cannot destroy token when revoking token.', { err }))
  }

  /*
    * Thanks to https://github.com/manjeshpv/node-oauth2-server-implementation/blob/master/components/oauth/mongo-models.js
    * "As per the discussion we need set older date
    * revokeToken will expected return a boolean in future version
    * https://github.com/oauthjs/node-oauth2-server/pull/274
    * https://github.com/oauthjs/node-oauth2-server/issues/290"
  */
  const expiredToken = token
  expiredToken.refreshTokenExpiresAt = new Date('2015-05-28T06:59:53.000Z')

  return expiredToken
}

async function saveToken (token: TokenInfo, client: OAuthClientModel, user: UserModel) {
  logger.debug('Saving token ' + token.accessToken + ' for client ' + client.id + ' and user ' + user.id + '.')

  const tokenToCreate = {
    accessToken: token.accessToken,
    accessTokenExpiresAt: token.accessTokenExpiresAt,
    refreshToken: token.refreshToken,
    refreshTokenExpiresAt: token.refreshTokenExpiresAt,
    oAuthClientId: client.id,
    userId: user.id
  }

  const tokenCreated = await OAuthTokenModel.create(tokenToCreate)
  return Object.assign(tokenCreated, { client, user })
}

// ---------------------------------------------------------------------------

// See https://github.com/oauthjs/node-oauth2-server/wiki/Model-specification for the model specifications
export {
  deleteUserToken,
  clearCacheByUserId,
  clearCacheByToken,
  getAccessToken,
  getClient,
  getRefreshToken,
  getUser,
  revokeToken,
  saveToken
}
