const amqp = require('amqplib'); // lib that allows u to communicate with rabbitmq

class RabbitMQService {
  constructor() { this.connection = null; //actual network connection to RabbitMQ
     this.channel = null; //logical communication path inside the channel
     }

  connect(cb) {
    if (this.channel) return cb(); //checks whether we already have a connection
    amqp.connect('amqp://guest:guest@localhost:5672')
      .then(conn => { this.connection = conn; return conn.createChannel(); })
      .then(ch => { this.channel = ch; return ch.assertExchange('payment_exchange', 'direct', {durable: true}); })
      .then(() => { console.log('Connected to RabbitMQ'); cb(); })
      .catch(cb);
  }

  publishPayment(payment, cb) {
    this.connect(err => {
      if (err) return cb(err);
      try {
        this.channel.publish('payment_exchange', 'payment.initiated',
          Buffer.from(JSON.stringify(payment)), {persistent: true});
        console.log('Payment published to RabbitMQ:', payment.id);
        cb(null);
      } catch (e) { cb(e); }
    });
  }
}
module.exports = RabbitMQService;
