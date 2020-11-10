import {
  ResultList,
  VideoFilter
} from '../../../shared/models'

// Hooks are using the form {hookType}:{api?}.{location}.{subLocation?}.{actionType}.{target}
export const serverFilterHookObject = {
  'filter:api.videos.list.params': true,
  'filter:api.videos.list.result': true,
  'filter:api.video.get.result': true,
  'filter:api.video.upload.accept.result': true,
  'filter:api.live-video.create.accept.result': true,
  'filter:api.video.pre-import-url.accept.result': true,
  'filter:api.video.pre-import-torrent.accept.result': true,
  'filter:api.video.post-import-url.accept.result': true,
  'filter:api.video.post-import-torrent.accept.result': true,
  'filter:api.video-thread.create.accept.result': true,
  'filter:api.video-comment-reply.create.accept.result': true,
  'filter:api.video-threads.list.params': true,
  'filter:api.video-threads.list.result': true,
  'filter:api.video-thread-comments.list.params': true,
  'filter:api.video-thread-comments.list.result': true,
  'filter:video.auto-blacklist.result': true,
  'filter:api.user.signup.allowed.result': true
}

export type ServerFilterHookName = keyof typeof serverFilterHookObject

/**
 * Test
 */
export interface ServerFilterHookType {
  /**
   * Filter params used to list videos for the REST API
   * (used by the trending page, recently-added page, local page etc)
   *
   * @category filter:api.videos
   */
  'filter:api.videos.list.params': {
    start?: number
    count?: number
    sort?: string
    includeLocalVideos?: boolean
    categoryOneOf?: string
    licenceOneOf?: string
    languageOneOf?: string
    tagsOneOf?: string
    tagsAllOf?: string[]
    nsfw?: boolean
    filter?: VideoFilter
    withFiles?: boolean
    user?: any
    countVideos?: boolean
  }
  /**
   * Filter result of listing videos for the REST API
   * (used by the trending page, recently-added page, local page etc)
   *
   * @category filter:api.videos
   */
  'filter:api.videos.list.result': ResultList<any>
  /**
   * Filter the result of the get function
   *
   * @category filter:api.video
   */
  'filter:api.video.get.result': any
  /**
   * Filter the result of the accept upload/live, import via torrent/url functions
   * If this function returns false then the upload is aborted with an error
   *
   * @category filter:api.video
   */
  'filter:api.video.upload.accept.result': any
  /**
   * @category filter:api.live-video
   */
  'filter:api.live-video.create.accept.result': any
  /**
   * @category filter:api.video
   */
  'filter:api.video.pre-import-url.accept.result': any
  /**
   * @category filter:api.video
   */
  'filter:api.video.pre-import-torrent.accept.result': any
  /**
   * @category filter:api.video
   */
  'filter:api.video.post-import-url.accept.result': any
  /**
   * @category filter:api.video
   */
  'filter:api.video.post-import-torrent.accept.result': any
  // Filter the result of the accept comment (thread or reply) functions
  // If the functions return false then the user cannot post its comment
  'filter:api.video-thread.create.accept.result': any
  'filter:api.video-comment-reply.create.accept.result': any

  /**
   * Filter params used to list threads of a specific video
   * (used by the video watch page)
   *
   * @category filter:api.video-threads
   */
  'filter:api.video-threads.list.params': any
  /**
   * Filter result obtained by listing threads of a specific video
   * (used by the video watch page)
   *
   * @category filter:api.video-threads
   */
  'filter:api.video-threads.list.result': any

  /**
   * Filter params/result used to list replies of a specific thread
   * (used by the video watch page when we click on the "View replies" button)
   *
   * @category filter:api.video-thread-comments
   */
  'filter:api.video-thread-comments.list.params': any
  'filter:api.video-thread-comments.list.result': any

  /**
   * Filter result used to check if we need to auto blacklist a video
   * (fired when a local or remote video is created or updated)
   */
  'filter:video.auto-blacklist.result': any

  /**
   * Filter result used to check if a user can register on the instance
   */
  'filter:api.user.signup.allowed.result': any
}

export const serverActionHookObject = {
  // Fired when the application has been loaded and is listening HTTP requests
  'action:application.listening': true,

  // Fired when a local video is updated
  'action:api.video.updated': true,
  // Fired when a local video is deleted
  'action:api.video.deleted': true,
  // Fired when a local video is uploaded
  'action:api.video.uploaded': true,
  // Fired when a local video is viewed
  'action:api.video.viewed': true,

  // Fired when a live video is created
  'action:api.live-video.created': true,

  // Fired when a thread is created
  'action:api.video-thread.created': true,
  // Fired when a reply to a thread is created
  'action:api.video-comment-reply.created': true,
  // Fired when a comment (thread or reply) is deleted
  'action:api.video-comment.deleted': true,

  // Fired when a user is blocked (banned)
  'action:api.user.blocked': true,
  // Fired when a user is unblocked (unbanned)
  'action:api.user.unblocked': true,
  // Fired when a user registered on the instance
  'action:api.user.registered': true,
  // Fired when an admin/moderator created a user
  'action:api.user.created': true,
  // Fired when a user is removed by an admin/moderator
  'action:api.user.deleted': true,
  // Fired when a user is updated by an admin/moderator
  'action:api.user.updated': true,

  // Fired when a user got a new oauth2 token
  'action:api.user.oauth2-got-token': true
}

export type ServerActionHookName = keyof typeof serverActionHookObject
export interface ServerActionHookType {
  // Fired when the application has been loaded and is listening HTTP requests
  'action:application.listening': any

  // Fired when a local video is updated
  'action:api.video.updated': any
  // Fired when a local video is deleted
  'action:api.video.deleted': any
  // Fired when a local video is uploaded
  'action:api.video.uploaded': any
  // Fired when a local video is viewed
  'action:api.video.viewed': any

  // Fired when a live video is created
  'action:api.live-video.created': any

  // Fired when a thread is created
  'action:api.video-thread.created': any
  // Fired when a reply to a thread is created
  'action:api.video-comment-reply.created': any
  // Fired when a comment (thread or reply) is deleted
  'action:api.video-comment.deleted': any

  // Fired when a user is blocked (banned)
  'action:api.user.blocked': any
  // Fired when a user is unblocked (unbanned)
  'action:api.user.unblocked': any
  // Fired when a user registered on the instance
  'action:api.user.registered': any
  // Fired when an admin/moderator created a user
  'action:api.user.created': any
  // Fired when a user is removed by an admin/moderator
  'action:api.user.deleted': any
  // Fired when a user is updated by an admin/moderator
  'action:api.user.updated': any

  // Fired when a user got a new oauth2 token
  'action:api.user.oauth2-got-token': any
}

export const serverHookObject = Object.assign({}, serverFilterHookObject, serverActionHookObject)
export type ServerHookName = ServerFilterHookName | ServerActionHookName
export type ServerHookType = ServerFilterHookType & ServerActionHookType

export interface ServerHook {
  runHook <U extends ServerHookName, T extends ServerHookType[U]> (
    hookName: U,
    result?: T,
    params?: any
  ): Promise<T>
}
