import * as express from 'express'
import validator from 'validator'
import { VideoCommentModel } from '@server/models/video/video-comment'
import { CONSTRAINTS_FIELDS } from '../../initializers/constants'
import { MVideoId } from '@server/types/models'
import { HttpStatusCode } from '../../../shared/core-utils/miscs/http-error-codes'

const VIDEO_COMMENTS_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.VIDEO_COMMENTS

function isValidVideoCommentText (value: string) {
  return value === null || validator.isLength(value, VIDEO_COMMENTS_CONSTRAINTS_FIELDS.TEXT)
}

async function doesVideoCommentThreadExist (idArg: number | string, video: MVideoId, res: express.Response) {
  const id = parseInt(idArg + '', 10)
  const videoComment = await VideoCommentModel.loadById(id)

  if (!videoComment) {
    res.fail({
      status: HttpStatusCode.NOT_FOUND_404,
      message: 'Video comment thread not found'
    })
    return false
  }

  if (videoComment.videoId !== video.id) {
    res.fail({ message: 'Video comment is not associated to this video.' })
    return false
  }

  if (videoComment.inReplyToCommentId !== null) {
    res.fail({ message: 'Video comment is not a thread.' })
    return false
  }

  res.locals.videoCommentThread = videoComment
  return true
}

async function doesVideoCommentExist (idArg: number | string, video: MVideoId, res: express.Response) {
  const id = parseInt(idArg + '', 10)
  const videoComment = await VideoCommentModel.loadByIdAndPopulateVideoAndAccountAndReply(id)

  if (!videoComment) {
    res.fail({
      status: HttpStatusCode.NOT_FOUND_404,
      message: 'Video comment thread not found'
    })
    return false
  }

  if (videoComment.videoId !== video.id) {
    res.fail({ message: 'Video comment is not associated to this video.' })
    return false
  }

  res.locals.videoCommentFull = videoComment
  return true
}

async function doesCommentIdExist (idArg: number | string, res: express.Response) {
  const id = parseInt(idArg + '', 10)
  const videoComment = await VideoCommentModel.loadByIdAndPopulateVideoAndAccountAndReply(id)

  if (!videoComment) {
    res.fail({
      status: HttpStatusCode.NOT_FOUND_404,
      message: 'Video comment thread not found'
    })
    return false
  }

  res.locals.videoCommentFull = videoComment
  return true
}

// ---------------------------------------------------------------------------

export {
  isValidVideoCommentText,
  doesVideoCommentThreadExist,
  doesVideoCommentExist,
  doesCommentIdExist
}
