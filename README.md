# E-Commerce Order & Payment Processing System

A demo e-commerce backend built with **LoopBack 3, PostgreSQL, RabbitMQ, Node-RED, Redis, and Node.js**.

The project demonstrates REST APIs, order checkout, asynchronous payment processing, payment authorization, settlement, Redis caching, and idempotent payment processing.

## Architecture

```text
Customer
   |
   | POST /api/orders/checkout
   v
LoopBack 3 API
   |
   +---- PostgreSQL
   |      Order / OrderItem / Payment / Product / Customer
   |
   +---- RabbitMQ
            |
            | payment.initiated
            v
         Node-RED
            |
            | Validate payment
            | Calculate 2% fee
            | status = authorized
            |
            | payment.authorized
            v
         RabbitMQ
            |
            v
      Node.js Worker
            |
            +---- Redis (idempotency)
            |
            +---- PostgreSQL
                   Payment = settled
                   Order = confirmed

Redis is also used for product/payment caching.
```

## Technologies

| Technology | Purpose |
|---|---|
| Node.js | API runtime and payment worker |
| LoopBack 3 | REST API and model-based CRUD APIs |
| PostgreSQL | Persistent database |
| RabbitMQ | Asynchronous message broker |
| Node-RED | Payment validation and authorization |
| Redis | Caching and payment idempotency |
| Docker Compose | Runs PostgreSQL, RabbitMQ, Redis and Node-RED |
| Swagger / LoopBack Explorer |

## Main Models

- **Customer** - customer information
- **Product** - product information and stock
- **Order** - customer order
- **OrderItem** - products belonging to an order
- **Payment** - payment information and status

Relationship:

```text
Customer
   |
   +----< Order
            |
            +----< OrderItem >---- Product
            |
            +---- Payment
```

# 1. Checkout API

The main custom business API is:

```http
POST /api/orders/checkout
```

Example request:

```json
{
  "customerId": 1,
  "items": [
    {
      "productId": 1,
      "quantity": 1
    }
  ],
  "paymentMethod": "UPI",
  "fromAccount": "CUSTOMER_ACC_001",
  "toAccount": "MERCHANT_ACC_001"
}
```

### Checkout flow

1. LoopBack receives the request.
2. Validates the customer.
3. Validates the product and stock.
4. Calculates the total amount.
5. Creates the order.
6. Creates the order item.
7. Updates product stock.
8. Creates the payment with `initiated` status.
9. Publishes the payment to RabbitMQ using `payment.initiated`.

Example payment message:

```json
{
  "id": 11,
  "orderId": 11,
  "amount": 79999,
  "currency": "INR",
  "fromAccount": "CUSTOMER_ACC_001",
  "toAccount": "MERCHANT_ACC_001",
  "paymentMethod": "UPI",
  "status": "initiated"
}
```

## 2. Node-RED Payment Processing

Node-RED consumes the `payment.initiated` message.

It validates:

- Payment ID
- Amount
- Currency
- Source account
- Destination account
- Source and destination accounts are different

It then calculates a **2% processing fee**.

For ₹79,999:

```text
Fee        = ₹79,999 × 2% = ₹1,599.98
Net amount = ₹79,999 - ₹1,599.98 = ₹78,399.02
```

The payment becomes:

```json
{
  "id": 11,
  "amount": 79999,
  "fee": 1599.98,
  "netAmount": 78399.02,
  "status": "authorized"
}
```

Node-RED publishes it using:

```text
payment.authorized
```

## 3. Payment Worker

The Node.js worker consumes `payment.authorized`.

Before processing, it checks Redis for:

```text
payment:processed:<paymentId>
```

Example:

```text
payment:processed:11
```

If the key already exists, processing is skipped.

If it does not exist:

1. Payment is updated to `settled`.
2. Order is updated to `confirmed`.
3. The idempotency key is stored in Redis with a TTL.

### Payment status

```text
initiated
    |
    v
authorized
    |
    v
settled
```

### Order status

```text
created
    |
    v
confirmed
```

# 4. Product Redis Cache

Custom API:

```http
GET /api/products/:id/cached
```

Flow:

```text
Request
   |
   v
Check Redis
   |
   +---- Hit ----> Return product
   |
   +---- Miss
          |
          v
      PostgreSQL
          |
          v
      Store in Redis
          |
          v
      Return product
```

Example Redis key:

```text
product:1
```

The cache uses a TTL.

# 5. Payment Cache API in Node-RED

Node-RED also exposes:

```http
GET /payment/:id
```

Example:

```bash
curl http://localhost:1880/payment/11
```

This uses the cache-aside pattern.

### Cache hit

```text
GET /payment/11
       |
       v
Redis GET payment:11
       |
       v
Return payment
```

### Cache miss

```text
GET /payment/11
       |
       v
Redis GET payment:11
       |
       v
Not found
       |
       v
PostgreSQL
       |
       v
Store in Redis
       |
       v
Return payment
```

# 6. Built-in LoopBack REST APIs

LoopBack automatically provides model-based CRUD APIs for public models.

Examples:

```http
GET    /api/products
GET    /api/products/:id
POST   /api/products
PATCH  /api/products/:id

GET    /api/customers
GET    /api/orders
GET    /api/order-items
GET    /api/payments
```

The project uses LoopBack's built-in model-based REST APIs rather than traditional controllers for CRUD operations.

API Explorer:

```text
http://localhost:3000/explorer
```

# 7. Running the Project

## Prerequisites

- Node.js
- npm
- Docker Desktop
- Git

## Start infrastructure

From the project root:

```bash
docker compose up -d
```

Services:

```text
PostgreSQL  → 5432
RabbitMQ    → 5672
RabbitMQ UI → 15672
Redis       → 6379
Node-RED    → 1880
```

## Start LoopBack API

```bash
cd payments-api
npm install
npm start
```

API:

```text
http://localhost:3000
```

Explorer:

```text
http://localhost:3000/explorer
```

## Start payment worker

In another terminal:

```bash
cd worker
npm install
node payment.worker.js
```

# 8. Testing

## Checkout

```bash
curl -X POST http://localhost:3000/api/orders/checkout -H "Content-Type: application/json" -d '{
  "customerId": 1,
  "items": [
    {
      "productId": 1,
      "quantity": 1
    }
  ],
  "paymentMethod": "UPI",
  "fromAccount": "CUSTOMER_ACC_001",
  "toAccount": "MERCHANT_ACC_001"
}'
```

## Product cache

```bash
curl http://localhost:3000/api/products/1/cached
```

## Payment cache

```bash
curl http://localhost:1880/payment/11
```

# 9. RabbitMQ Message Flow

### Payment initiation

```text
LoopBack
   |
   | payment.initiated
   v
RabbitMQ
   |
   v
Node-RED
```

### Payment authorization

```text
Node-RED
   |
   | payment.authorized
   v
RabbitMQ
   |
   v
Node.js Worker
```

# 10. Idempotency

Redis prevents duplicate payment processing.

```text
Receive payment
      |
      v
Check Redis
      |
      +---- Key exists ----> Skip
      |
      +---- Key missing
               |
               v
        Settle payment
               |
               v
        Confirm order
               |
               v
        Store Redis key
```

# 11. Project Structure

```text
ecommerce-payments-loopback3/
│
├── payments-api/
│   ├── common/
│   │   ├── models/
│   │   └── services/
│   ├── server/
│   │   ├── boot/
│   │   ├── config.json
│   │   ├── datasources.json
│   │   ├── model-config.json
│   │   └── server.js
│   └── package.json
│
├── worker/
│   └── payment.worker.js
│
├── node-red-data/
│   └── flows.json
│
├── docker-compose.yml
├── .gitignore
└── README.md
```

