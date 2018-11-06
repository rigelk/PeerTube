import { writeFileSync } from 'fs-extra'
import { safeDump } from 'js-yaml'
const swaggerJSDoc = require('swagger-jsdoc')
const packageJSON = require('../../../../package.json')

const swaggerPath = './support/doc/api/swagger.yaml'
const swaggerDefinition = {
  openapi: '3.0.0',
  tags: [
    { name: 'PeerTube' },
    { name: 'Server' }
  ],
  info: {
    title: 'PeerTube',
    version: packageJSON.version,
    description: packageJSON.description,
    contact: {
      email: 'chocobozzz@cpy.re',
      url: 'https://github.com/Chocobozzz/PeerTube/'
    },
    'x-logo': {
      url: 'https://joinpeertube.org/img/brand.png',
      alt: 'PeerTube brand logo'
    },
    license: {
      name: 'AGPLv3.0',
      url: 'https://choosealicense.com/licenses/agpl-3.0/'
    }
  },
  externalDocs: {
    description: 'Find more documentation about PeerTube in general to integrate and work with it.',
    url: 'http://docs.joinpeertube.org/'
  },
  servers: [
    {
      url: 'https://peertube.cpy.re/api/v1',
      description: 'Production server (uses live data)'
    }
  ]
}
const options = {
  swaggerDefinition,
  apis: [
    'dist/server/controllers/**/*.js',
    'support/doc/api/security.yaml',
    'support/doc/api/users.yaml',
    'support/doc/api/accounts.yaml',
    'support/doc/api/commons.yaml',
    'support/doc/api/videos.yaml',
    'support/doc/api/video-channels.yaml',
    'support/doc/api/video-comments.yaml'
  ]
}

const swaggerSpec = swaggerJSDoc(options)
writeFileSync(swaggerPath, safeDump(swaggerSpec))
