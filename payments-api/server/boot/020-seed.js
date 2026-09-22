module.exports = function(app) {
  const ds = app.dataSources.db;

  ds.on('connected', function() {
    console.log('PostgreSQL connected. Starting seed...');

    const Customer = app.models.Customer;
    const Product = app.models.Product;

    Customer.findOrCreate(
      {where: {email: 'customer@example.com'}},
      {
        name: 'Test Customer',
        email: 'customer@example.com',
        phone: '9876543210'
      },
      function(err) {
        if (err) {
          console.error('Customer seed failed:', err.message);
          return;
        }

        console.log('Customer seed completed.');

        Product.findOrCreate(
          {where: {name: 'Laptop'}},
          {
            name: 'Laptop',
            description: 'Training Laptop',
            price: 79999,
            stock: 10,
            category: 'Electronics'
          },
          function(err) {
            if (err) {
              console.error('Product seed failed:', err.message);
              return;
            }

            console.log('Product seed completed.');
          }
        );
      }
    );
  });
};