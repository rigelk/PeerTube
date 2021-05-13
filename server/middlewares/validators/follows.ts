import * as express from 'express'
import { body, param, query } from 'express-validator'
import { checkFollowState } from '@server/helpers/custom-validators/follows'
import { getServerActor } from '@server/models/application/application'
import { MActorFollowActorsDefault } from '@server/types/models'
import { HttpStatusCode } from '../../../shared/core-utils/miscs/http-error-codes'
import { isTestInstance } from '../../helpers/core-utils'
import { isActorTypeValid, isValidActorHandle } from '../../helpers/custom-validators/activitypub/actor'
import { isEachUniqueHostValid, checkHost } from '../../helpers/custom-validators/servers'
import { logger } from '../../helpers/logger'
import { loadActorUrlOrGetFromWebfinger } from '../../helpers/webfinger'
import { SERVER_ACTOR_NAME, WEBSERVER } from '../../initializers/constants'
import { ActorModel } from '../../models/actor/actor'
import { ActorFollowModel } from '../../models/actor/actor-follow'
import { areValidationErrors } from './utils'

const listFollowsValidator = [
  query('state')
    .optional()
    .custom(checkFollowState),
  query('actorType')
    .optional()
    .custom(isActorTypeValid).withMessage('Should have a valid actor type'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    return next()
  }
]

const followValidator = [
  body('hosts').custom(isEachUniqueHostValid).withMessage('Should have an array of unique hosts'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Force https if the administrator wants to make friends
    if (isTestInstance() === false && WEBSERVER.SCHEME === 'http') {
      return res
        .status(HttpStatusCode.INTERNAL_SERVER_ERROR_500)
        .json({
          error: 'Cannot follow on a non HTTPS web server.'
        })
        .end()
    }

    logger.debug('Checking follow parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

const removeFollowingValidator = [
  param('host')
    .custom(checkHost),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking unfollowing parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return

    const serverActor = await getServerActor()
    const follow = await ActorFollowModel.loadByActorAndTargetNameAndHostForAPI(serverActor.id, SERVER_ACTOR_NAME, req.params.host)

    if (!follow) {
      return res
        .status(HttpStatusCode.NOT_FOUND_404)
        .json({
          error: `Following ${req.params.host} not found.`
        })
    }

    res.locals.follow = follow
    return next()
  }
]

const getFollowerValidator = [
  param('nameWithHost').custom(isValidActorHandle).withMessage('Should have a valid nameWithHost'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking get follower parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return

    let follow: MActorFollowActorsDefault
    try {
      const actorUrl = await loadActorUrlOrGetFromWebfinger(req.params.nameWithHost)
      const actor = await ActorModel.loadByUrl(actorUrl)

      const serverActor = await getServerActor()
      follow = await ActorFollowModel.loadByActorAndTarget(actor.id, serverActor.id)
    } catch (err) {
      logger.warn('Cannot get actor from handle.', { handle: req.params.nameWithHost, err })
    }

    if (!follow) {
      return res
        .status(HttpStatusCode.NOT_FOUND_404)
        .json({
          error: `Follower ${req.params.nameWithHost} not found.`
        })
        .end()
    }

    res.locals.follow = follow
    return next()
  }
]

const acceptOrRejectFollowerValidator = [
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking accept/reject follower parameters', { parameters: req.params })

    const follow = res.locals.follow
    if (follow.state !== 'pending') {
      return res
        .status(HttpStatusCode.BAD_REQUEST_400)
        .json({
          error: 'Follow is not in pending state.'
        })
        .end()
    }

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  followValidator,
  removeFollowingValidator,
  getFollowerValidator,
  acceptOrRejectFollowerValidator,
  listFollowsValidator
}
