var loopback = require('loopback');
var boot = require('loopback-boot');

var app = module.exports = loopback();

boot(app, __dirname, function(err) {
  if (err) throw err;

  // Built-in LoopBack REST APIs
  app.use(app.get('restApiRoot'), loopback.rest());

  app.start = function() {
    return app.listen(function() {
      app.emit('started');

      var baseUrl = app.get('url').replace(/\/$/, '');
      console.log('Web server listening at: %s', baseUrl);

      // Create/update PostgreSQL tables
      app.dataSources.db.autoupdate(function(err) {
        if (err) {
          console.error('Database migration failed:', err);
          return;
        }

        console.log('Database tables created successfully.');
      });
    });
  };

  if (require.main === module) {
    app.start();
  }
});