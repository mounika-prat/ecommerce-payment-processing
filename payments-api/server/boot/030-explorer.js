module.exports = function(app) {
  var explorer = require('loopback-component-explorer');

  explorer(app, {
    mountPath: '/explorer'
  });
};