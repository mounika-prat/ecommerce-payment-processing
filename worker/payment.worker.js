const amqp = require('amqplib');
const {Pool} = require('pg');
const Redis = require('ioredis');

const db = new Pool({host:'localhost', port:5432, database:'payments', user:'payments', password:'payments'});
const redis = new Redis({host:'localhost', port:6379});
const QUEUE = 'authorized_payment_queue'; //which queues should i listen to?

async function start() {
  const conn = await amqp.connect('amqp://guest:guest@localhost:5672');
  const ch = await conn.createChannel();
  await ch.assertExchange('payment_exchange', 'direct', {durable:true});
  await ch.assertQueue(QUEUE, {durable:true});
  //connect the queue to exchange
  await ch.bindQueue(QUEUE, 'payment_exchange', 'payment.authorized');
  console.log('Worker started...');
  console.log(`Waiting for messages from ${QUEUE}`);

  ch.consume(QUEUE, async msg => {
    if (!msg) return;
    try {
      const payment = JSON.parse(msg.content.toString());
      console.log('Received payment:', payment);
      const key = `payment:processed:${payment.id}`; // redis key creation
      if (await redis.get(key)) { //did we already process this payment?
        console.log(`Payment ${payment.id} already processed. Skipping.`);
        ch.ack(msg); return; //acknowledge the message to remove it from the queue
      }
      if (payment.status === 'authorized') {
        await db.query('UPDATE payment SET status=$1, fee=$2, netamount=$3 WHERE id=$4',
          ['settled', payment.fee || null, payment.netAmount || null, payment.id]);
        await db.query('UPDATE "order" SET status=$1 WHERE id=$2', ['confirmed', payment.orderId]);
        await redis.set(key, 'settled', 'EX', 3600);
        console.log(`Redis key created: ${key}`);
        console.log(`Payment ${payment.id} settled successfully.`);
        console.log(`Order ${payment.orderId} confirmed.`);
      }
      ch.ack(msg);
    } catch (e) {
      console.error('Error processing payment:', e);
      ch.nack(msg, false, true);
    }
  });
}
start().catch(e => {console.error('Worker failed to start:', e); process.exit(1);});
