var GenerateWebLabelsPlugin = require('./generate-weblabels-webpack-plugin')

module.exports = {
  plugins: [
    new GenerateWebLabelsPlugin({
      exclude: [
        'indexof',
        'sha.js'
      ]
    })
  ]
}
