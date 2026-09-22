//we r just like binding the cachedFindById function to a REST endpoint so that we can call it from the outside world

//It tries to get a product from Redis first; if Redis doesn't have it, it gets the product from PostgreSQL, 
// stores it in Redis for 5 minutes, and then returns it.
const Redis = require('ioredis');

module.exports = function(Product) {// passing the product model into the function so that we can add a new method to it
  const redis = new Redis({host: 'localhost', port: 6379});// creating a connection from node.js to redis

  Product.cachedFindById = function(id, cb) {//find a product by id but first check redis before going to postgres
    const key = `product:${id}`;//creating redis key
    redis.get(key, function(redisErr, cached) {//do u have the product stored under this key
      if (cached) {
        return cb(null, {source: 'redis', cacheHit: true, product: JSON.parse(cached)});
      }
      Product.findById(id, function(dbErr, product) {
        if (dbErr) return cb(dbErr);
        if (!product) return cb(new Error('Product not found'));//if product doesnt exist
        redis.setex(key, 300, JSON.stringify(product.toObject()), function(setErr) {
          if (setErr) console.log('Redis cache set failed:', setErr.message);
          cb(null, {source: 'database', cacheHit: false, product: product});
        });
      });
    });
  };
//product model object -> json object -> string -> store in redis


//Take my cachedFindById function and expose it as a REST API.
  Product.remoteMethod('cachedFindById', {
    accepts: {arg: 'id', type: 'number', required: true, http: {source: 'path'}},
    returns: {arg: 'result', type: 'object', root: true},
    http: {path: '/:id/cached', verb: 'get'}
  });
};
