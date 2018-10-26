#!/bin/sh

set -eu

rm -rf ./dist/server

# Generate the OpenAPI spec
npm run tsc -- --removeComments false
node dist/support/doc/api/swaggerGen.js

# Generate the OpenAPI spec static page to ease browsing
npm run spectacle-docs -- -t support/doc/api/html support/doc/api/openapi.yaml
