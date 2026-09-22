const RabbitMQService = require('../../common/services/rabbitmq.service');
module.exports = function(app) {
  const rabbit = new RabbitMQService();
  app.set('rabbitmqService', rabbit);
  rabbit.connect(err => {
    if (err) console.error('RabbitMQ connection failed:', err.message);
  });
};
