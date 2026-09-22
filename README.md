# E-Commerce + Payment Processing — LoopBack 3

Complete training project using LoopBack 3 model-based REST APIs, PostgreSQL, RabbitMQ, Node-RED, Redis and Docker.

## Important
No traditional controller files are used. LoopBack 3 automatically exposes CRUD APIs from model JSON files. Custom operations use LoopBack 3 remote methods attached to models.

## Start
From root:
```bash
docker compose up -d
```

RabbitMQ UI: http://localhost:15672 (guest/guest)
Node-RED: http://localhost:1880

API:
```bash
cd payments-api
npm install
npm start
```

Worker, in another terminal:
```bash
cd worker
npm install
npm start
```

## API root
http://localhost:3000/api

CRUD examples:
GET/POST /api/customers
GET/POST /api/products
GET/POST /api/orders
GET/POST /api/orderItems
GET/POST /api/payments

## Checkout
POST /api/orders/checkout

Body:
```json
{
  "customerId": 1,
  "items": [{"productId": 1, "quantity": 1}],
  "paymentMethod": "UPI"
}
```

Payment flow:
LoopBack -> PostgreSQL -> RabbitMQ(payment.initiated) -> Node-RED -> RabbitMQ(payment.authorized) -> Worker -> PostgreSQL + Redis.

Redis idempotency:
payment:processed:<paymentId> with 1-hour TTL.

Redis product cache:
GET /api/products/:id/cached

First call is a database/cache miss and stores product:<id> for 5 minutes. Second call is a Redis cache hit.

## Notes
The checkout code is for training. Production systems should add database transactions, concurrency-safe stock updates, authentication, secrets management, dead-letter queues and stronger validation.
