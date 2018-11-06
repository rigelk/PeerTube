#!/bin/sh

set -eu

rm -rf ./dist/server

# Generate the OpenAPI spec
npm run tsc -- --removeComments false
node dist/support/doc/api/swaggerGen.js

# Lint the OpenAPI spec
node ./node_modules/speccy/speccy.js lint support/doc/api/swagger.yaml

# Generate the OpenAPI spec static page to ease browsing
npm run spectacle-docs -- -t support/doc/api/html support/doc/api/openapi.yaml
