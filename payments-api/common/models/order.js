module.exports = function(Order) {
  Order.checkout = function(data, cb) {
    const app = Order.app;
    const Customer = app.models.Customer;
    const Product = app.models.Product;
    const OrderItem = app.models.OrderItem;
    const Payment = app.models.Payment;
    const rabbit = app.get('rabbitmqService');//RabbitMQ service that was registered in your LoopBack application.

    if (!data || !data.customerId || !Array.isArray(data.items) ||
        !data.items.length || !data.paymentMethod) {
      return cb(new Error('customerId, items and paymentMethod are required'));
    }
    //customer exists or not
    Customer.findById(data.customerId, function(err, customer) {
      if (err) return cb(err);
      if (!customer) return cb(new Error('Customer not found'));

      const validated = [];
      let remaining = data.items.length;
      let finished = false;

      //for each item present in the order it processes
      data.items.forEach(function(item) {
        if (!item.productId || !Number.isInteger(item.quantity) || item.quantity <= 0) {
          if (!finished) { finished = true; cb(new Error('Invalid productId or quantity')); }
          return;
        }
        //for every item, we check if the product exists
        Product.findById(item.productId, function(err2, product) {
          if (finished) return;
          if (err2) { finished = true; return cb(err2); }
          //product here is productId checks id the productid is present
          if (!product) { finished = true; return cb(new Error(`Product ${item.productId} not found`)); }
          //if stock is less than the quantity requested
          if (product.stock < item.quantity) {
            finished = true; return cb(new Error(`Not enough stock for product ${product.name}`));
          }
          validated.push({productId: product.id, quantity: item.quantity, price: Number(product.price), product});
          //decrease the items
          remaining--;
          if (remaining) return;
        //{
        //   "customerId": 1,
        //     "items": [
        //       {
        //         "productId": 1,
        //         "quantity": 1
        //       }
        //     ],
        //       "paymentMethod": "UPI"
        // }
        //calculate the total amount here
          const total = validated.reduce((sum, v) => sum + v.price * v.quantity, 0);
          //this creates the order
          Order.create({customerId: data.customerId, totalAmount: total, status: 'pending'}, function(e3, order) {
            if (e3) return cb(e3);
            let n = validated.length;
            validated.forEach(v => {
              //creates individual order items belonging to that order
              OrderItem.create({orderId: order.id, productId: v.productId, quantity: v.quantity, price: v.price}, function(e4) {
                if (e4 || finished) { if (e4 && !finished) { finished = true; cb(e4); } return; }
                //this will decrease the stock of the product in the database after the order is created
                Product.updateAll({id: v.productId}, {stock: v.product.stock - v.quantity}, function(e5) {
                  if (e5 || finished) { if (e5 && !finished) { finished = true; cb(e5); } return; }
                  n--;
                  if (n) return;
                  //this creates the payment for the order
                  Payment.create({
                    orderId: order.id, amount: total, currency: 'INR',
                    fromAccount: 'CUSTOMER_ACC_001', toAccount: 'MERCHANT_ACC_001',
                    paymentMethod: data.paymentMethod, status: 'initiated'
                  }, function(e6, payment) {
                    if (e6) return cb(e6);
                    //You're taking the payment you just created and sending it to RabbitMQ.
                    rabbit.publishPayment(payment.toObject(), function(e7) {
                      if (e7) return cb(e7);
                      cb(null, {message: 'Checkout successful', order, payment,
                        items: validated.map(v => ({productId: v.productId, quantity: v.quantity, price: v.price}))});
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  };

  Order.remoteMethod('checkout', {
    accepts: {arg: 'data', type: 'object', http: {source: 'body'}, required: true},
    returns: {arg: 'result', type: 'object', root: true},
    http: {path: '/checkout', verb: 'post'}
  });
};
