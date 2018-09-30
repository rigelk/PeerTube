/* @options is the hash of options the user passes in when creating an instance
 * of the plugin.
 * @imports is a hash of all services this plugin consumes.
 * @register is the callback to be called when the plugin is done initializing.
 */
module.exports = function setup(options, imports, register) {
    // core.app is the Express runtime of PeerTube
    const app = imports.core.app
  
    imports.logger.info('Owo World!')
    app.get('/owo', (_, res) => res.send('Owo World!'))
  }