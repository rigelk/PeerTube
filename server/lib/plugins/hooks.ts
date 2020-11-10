import { ServerActionHookName, ServerFilterHookName, ServerFilterHookType } from '../../types/plugins/server-hook.model'
import { PluginManager } from './plugin-manager'
import { logger } from '../../helpers/logger'
import * as Bluebird from 'bluebird'

type PromiseFunction <U, T> = (params: U) => Promise<T> | Bluebird<T>
type RawFunction <U, T> = (params: U) => T

// Helpers to run hooks
const Hooks = {
  wrapObject: <U extends ServerFilterHookName, T extends ServerFilterHookType[U]>(result: T, hookName: U) => {
    return PluginManager.Instance.runHook(hookName, result)
  },

  wrapPromiseFun: async <P, U extends ServerFilterHookName, T extends ServerFilterHookType[U]>(
    fun: PromiseFunction<P, T>,
    params: P,
    hookName: U
  ) => {
    const result = await fun(params)

    return PluginManager.Instance.runHook(hookName, result, params)
  },

  wrapFun: async <V, U extends ServerFilterHookName, T extends ServerFilterHookType[U]>(fun: RawFunction<V, T>, params: V, hookName: U) => {
    const result = fun(params)

    return PluginManager.Instance.runHook(hookName, result, params)
  },

  runAction: <P, U extends ServerActionHookName>(hookName: U, params?: P) => {
    PluginManager.Instance.runHook(hookName, undefined, params)
      .catch(err => logger.error('Fatal hook error.', { err }))
  }
}

export {
  Hooks
}
