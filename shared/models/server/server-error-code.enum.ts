export const enum ServerErrorCode {
  /**
   * Error yielded upon trying to access a video that is not federated, nor can
   * be. This may be due to: remote videos on instances that are not followed by
   * yours, and with your instance disallowing unknown instances being accessed.
   */
  DOES_NOT_RESPECT_FOLLOW_CONSTRAINTS = 'does_not_respect_follow_constraints',

  /**
   * Pretty self-explanatory: the set maximum number of simultaneous lives was
   * reached, and this error is typically there to inform the user trying to
   * broadcast one.
   */
  MAX_INSTANCE_LIVES_LIMIT_REACHED = 'max_instance_lives_limit_reached',

  /**
   * Pretty self-explanatory: the set maximum number of simultaneous lives FOR
   * THIS USER was reached, and this error is typically there to inform the user
   * trying to broadcast one.
   */
  MAX_USER_LIVES_LIMIT_REACHED = 'max_user_lives_limit_reached',

  /**
   * A torrent should have at most one correct video file. Any more and we will
   * not be able to choose automatically.
   */
  INCORRECT_FILES_IN_TORRENT = 'incorrect_files_in_torrent'
}

/**
 * oauthjs/oauth2-server error codes
 * @see https://datatracker.ietf.org/doc/html/rfc6749#section-5.2
 **/
export const enum OAuth2ErrorCode {
  /**
   * The provided authorization grant (e.g., authorization code, resource owner
   * credentials) or refresh token is invalid, expired, revoked, does not match
   * the redirection URI used in the authorization request, or was issued to
   * another client.
   *
   * @see https://github.com/oauthjs/node-oauth2-server/blob/master/lib/errors/invalid-grant-error.js
   */
  INVALID_GRANT = 'invalid_grant',

  /**
   * Client authentication failed (e.g., unknown client, no client authentication
   * included, or unsupported authentication method).
   *
   * @see https://github.com/oauthjs/node-oauth2-server/blob/master/lib/errors/invalid-client-error.js
   */
  INVALID_CLIENT = 'invalid_client'
}
