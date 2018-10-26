import * as express from 'express'
import { Activity, ActivityPubCollection, ActivityPubOrderedCollection, RootActivity } from '../../../shared'
import { isActivityValid } from '../../helpers/custom-validators/activitypub/activity'
import { logger } from '../../helpers/logger'
import { processActivities } from '../../lib/activitypub/process/process'
import { asyncMiddleware, checkSignature, localAccountValidator, localVideoChannelValidator, signatureValidator } from '../../middlewares'
import { activityPubValidator } from '../../middlewares/validators/activitypub/activity'
import { VideoChannelModel } from '../../models/video/video-channel'
import { AccountModel } from '../../models/account/account'
import { queue } from 'async'
import { ActorModel } from '../../models/activitypub/actor'

const inboxRouter = express.Router()

/**
 * @todo write swagger definition
 */
inboxRouter.post('/inbox',
  signatureValidator,
  asyncMiddleware(checkSignature),
  asyncMiddleware(activityPubValidator),
  inboxController
)

/**
 * @todo write swagger definition
 */
inboxRouter.post('/accounts/:name/inbox',
  signatureValidator,
  asyncMiddleware(checkSignature),
  asyncMiddleware(localAccountValidator),
  asyncMiddleware(activityPubValidator),
  inboxController
)

/**
 * @todo write swagger definition
 */
inboxRouter.post('/video-channels/:name/inbox',
  signatureValidator,
  asyncMiddleware(checkSignature),
  asyncMiddleware(localVideoChannelValidator),
  asyncMiddleware(activityPubValidator),
  inboxController
)

// ---------------------------------------------------------------------------

export {
  inboxRouter
}

// ---------------------------------------------------------------------------

const inboxQueue = queue<{ activities: Activity[], signatureActor?: ActorModel, inboxActor?: ActorModel }, Error>((task, cb) => {
  processActivities(task.activities, task.signatureActor, task.inboxActor)
    .then(() => cb())
})

function inboxController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const rootActivity: RootActivity = req.body
  let activities: Activity[] = []

  if ([ 'Collection', 'CollectionPage' ].indexOf(rootActivity.type) !== -1) {
    activities = (rootActivity as ActivityPubCollection).items
  } else if ([ 'OrderedCollection', 'OrderedCollectionPage' ].indexOf(rootActivity.type) !== -1) {
    activities = (rootActivity as ActivityPubOrderedCollection<Activity>).orderedItems
  } else {
    activities = [ rootActivity as Activity ]
  }

  // Only keep activities we are able to process
  logger.debug('Filtering %d activities...', activities.length)
  activities = activities.filter(a => isActivityValid(a))
  logger.debug('We keep %d activities.', activities.length, { activities })

  let accountOrChannel: VideoChannelModel | AccountModel
  if (res.locals.account) {
    accountOrChannel = res.locals.account
  } else if (res.locals.videoChannel) {
    accountOrChannel = res.locals.videoChannel
  }

  logger.info('Receiving inbox requests for %d activities by %s.', activities.length, res.locals.signature.actor.url)

  inboxQueue.push({
    activities,
    signatureActor: res.locals.signature.actor,
    inboxActor: accountOrChannel ? accountOrChannel.Actor : undefined
  })

  return res.status(204).end()
}
