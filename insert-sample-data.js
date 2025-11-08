#!/usr/bin/env node

/**
 * Insert Sample Data into Cloud SQL Database
 * Creates sample hubs, drivers, customers, and orders for testing analytics
 */

const { Pool } = require('pg');

const DB_CONFIG = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'barq_logistics',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'BARQFleet2025SecurePass!',
};

console.log('🔄 Connecting to database...');
console.log(`   Host: ${DB_CONFIG.host}`);
console.log(`   Database: ${DB_CONFIG.database}`);

async function insertSampleData() {
  const pool = new Pool(DB_CONFIG);

  try {
    console.log('\n📊 Inserting sample data...\n');

    // 1. Insert sample hubs
    console.log('1️⃣ Creating sample hubs...');
    const hubsResult = await pool.query(`
      INSERT INTO hubs (code, manager, mobile, latitude, longitude, is_active, opening_time, closing_time)
      VALUES
        ('RYD-01', 'Ahmed Al-Rashid', '+966501234567', 24.7136, 46.6753, true, '06:00:00', '22:00:00'),
        ('JED-01', 'Mohammed Al-Otaibi', '+966502345678', 21.5433, 39.1728, true, '06:00:00', '22:00:00'),
        ('DMM-01', 'Khalid Al-Mutairi', '+966503456789', 26.4207, 50.0888, true, '07:00:00', '21:00:00')
      ON CONFLICT DO NOTHING
      RETURNING id, code;
    `);
    console.log(`   ✅ Created ${hubsResult.rows.length} hubs`);
    hubsResult.rows.forEach(row => console.log(`      - ${row.code} (ID: ${row.id})`));

    // 2. Insert sample drivers
    console.log('\n2️⃣ Creating sample drivers...');
    const driversResult = await pool.query(`
      INSERT INTO drivers (employee_id, name, phone, email, vehicle_type, vehicle_number, status, current_latitude, current_longitude, rating)
      VALUES
        ('DRV-001', 'Omar Hassan', '+966511111111', 'omar.hassan@barq.sa', 'MOTORCYCLE', 'ABC-1234', 'available', 24.7200, 46.6800, 4.8),
        ('DRV-002', 'Fahad Al-Qahtani', '+966512222222', 'fahad.qahtani@barq.sa', 'MOTORCYCLE', 'ABC-1235', 'available', 24.7300, 46.6900, 4.9),
        ('DRV-003', 'Abdullah Saeed', '+966513333333', 'abdullah.saeed@barq.sa', 'CAR', 'ABC-1236', 'available', 21.5500, 39.1800, 4.7),
        ('DRV-004', 'Saud Al-Harbi', '+966514444444', 'saud.harbi@barq.sa', 'MOTORCYCLE', 'ABC-1237', 'busy', 24.7100, 46.6700, 4.6),
        ('DRV-005', 'Faisal Al-Dawsari', '+966515555555', 'faisal.dawsari@barq.sa', 'CAR', 'ABC-1238', 'available', 26.4300, 50.1000, 4.9)
      ON CONFLICT (employee_id) DO NOTHING
      RETURNING id, name, employee_id;
    `);
    console.log(`   ✅ Created ${driversResult.rows.length} drivers`);
    driversResult.rows.forEach(row => console.log(`      - ${row.name} (${row.employee_id})`));

    // 3. Insert sample customers
    console.log('\n3️⃣ Creating sample customers...');
    const customersResult = await pool.query(`
      INSERT INTO customers (name, phone, email, language)
      VALUES
        ('Sara Al-Malki', '+966521111111', 'sara.malki@example.com', 'ar'),
        ('Nora Al-Subaie', '+966522222222', 'nora.subaie@example.com', 'ar'),
        ('Layla Al-Dosari', '+966523333333', 'layla.dosari@example.com', 'ar'),
        ('Hala Al-Zahrani', '+966524444444', 'hala.zahrani@example.com', 'ar'),
        ('Reem Al-Shehri', '+966525555555', 'reem.shehri@example.com', 'ar'),
        ('Maha Al-Otaibi', '+966526666666', 'maha.otaibi@example.com', 'ar'),
        ('Nouf Al-Mutairi', '+966527777777', 'nouf.mutairi@example.com', 'ar'),
        ('Lina Al-Harbi', '+966528888888', 'lina.harbi@example.com', 'ar')
      ON CONFLICT DO NOTHING
      RETURNING id, name;
    `);
    console.log(`   ✅ Created ${customersResult.rows.length} customers`);

    // Get IDs for creating orders
    const hubs = (await pool.query('SELECT id FROM hubs LIMIT 3')).rows;
    const drivers = (await pool.query('SELECT id FROM drivers LIMIT 5')).rows;
    const customers = (await pool.query('SELECT id FROM customers LIMIT 8')).rows;

    if (hubs.length === 0 || drivers.length === 0 || customers.length === 0) {
      console.log('\n⚠️  Not enough data to create orders. Aborting.');
      return;
    }

    // 4. Insert sample orders
    console.log('\n4️⃣ Creating sample orders...');

    const now = new Date();
    const orders = [];

    // Generate 15 orders with varied statuses and timestamps
    const statuses = ['delivered', 'delivered', 'delivered', 'delivered', 'delivered',
                      'in_transit', 'in_transit', 'picked_up', 'assigned', 'pending'];

    for (let i = 0; i < 15; i++) {
      const hoursAgo = Math.floor(Math.random() * 48); // Within last 48 hours
      const createdAt = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
      const customer = customers[i % customers.length];
      const driver = drivers[i % drivers.length];
      const hub = hubs[i % hubs.length];
      const status = statuses[i % statuses.length];

      // Delivery time varies based on service type
      const serviceType = i % 3 === 0 ? 'BARQ' : 'BULLET';
      const slaMinutes = serviceType === 'BARQ' ? 60 : 180;
      const slaDeadline = new Date(createdAt.getTime() + slaMinutes * 60 * 1000);

      // Calculate timestamps based on status
      let assignedAt = null, pickedUpAt = null, deliveredAt = null, slaBreached = false;

      if (['assigned', 'picked_up', 'in_transit', 'delivered'].includes(status)) {
        assignedAt = new Date(createdAt.getTime() + 5 * 60 * 1000); // 5 min after creation
      }
      if (['picked_up', 'in_transit', 'delivered'].includes(status)) {
        pickedUpAt = new Date(assignedAt.getTime() + 10 * 60 * 1000); // 10 min after assignment
      }
      if (status === 'delivered') {
        const deliveryDelay = Math.floor(Math.random() * 20) + 30; // 30-50 minutes
        deliveredAt = new Date(pickedUpAt.getTime() + deliveryDelay * 60 * 1000);
        slaBreached = deliveredAt > slaDeadline;
      }

      orders.push(`
        ('ORD-${String(i + 1).padStart(4, '0')}',
         '${customer.id}',
         ${status === 'pending' ? 'NULL' : `'${driver.id}'`},
         '${serviceType}',
         '${status}',
         24.${7100 + Math.floor(Math.random() * 100)},
         46.${6700 + Math.floor(Math.random() * 100)},
         '{"street": "King Fahd Road", "city": "Riyadh"}',
         24.${7200 + Math.floor(Math.random() * 100)},
         46.${6800 + Math.floor(Math.random() * 100)},
         '{"street": "Olaya Street", "city": "Riyadh"}',
         ${5 + Math.floor(Math.random() * 15)},
         '${createdAt.toISOString()}',
         ${assignedAt ? `'${assignedAt.toISOString()}'` : 'NULL'},
         ${pickedUpAt ? `'${pickedUpAt.toISOString()}'` : 'NULL'},
         ${deliveredAt ? `'${deliveredAt.toISOString()}'` : 'NULL'},
         '${slaDeadline.toISOString()}',
         ${slaBreached},
         ${50 + Math.floor(Math.random() * 50)},
         ${1 + Math.random()})
      `);
    }

    const ordersQuery = `
      INSERT INTO orders (
        order_number, customer_id, driver_id, service_type, status,
        pickup_latitude, pickup_longitude, pickup_address,
        dropoff_latitude, dropoff_longitude, dropoff_address,
        estimated_distance, created_at, assigned_at, picked_up_at, delivered_at,
        sla_deadline, sla_breached, delivery_fee, surge_multiplier
      ) VALUES ${orders.join(',')}
      RETURNING id, order_number, status;
    `;

    const ordersResult = await pool.query(ordersQuery);
    console.log(`   ✅ Created ${ordersResult.rows.length} orders`);

    // Show status breakdown
    const statusBreakdown = ordersResult.rows.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {});

    console.log('\n   📈 Order Status Breakdown:');
    Object.entries(statusBreakdown).forEach(([status, count]) => {
      console.log(`      - ${status}: ${count}`);
    });

    // 5. Verify data
    console.log('\n5️⃣ Verifying inserted data...');
    const verification = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM hubs) as hubs_count,
        (SELECT COUNT(*) FROM drivers) as drivers_count,
        (SELECT COUNT(*) FROM customers) as customers_count,
        (SELECT COUNT(*) FROM orders) as orders_count
    `);

    console.log('\n📊 Database Summary:');
    console.log(`   🏢 Hubs: ${verification.rows[0].hubs_count}`);
    console.log(`   🚗 Drivers: ${verification.rows[0].drivers_count}`);
    console.log(`   👥 Customers: ${verification.rows[0].customers_count}`);
    console.log(`   📦 Orders: ${verification.rows[0].orders_count}`);

    console.log('\n✅ Sample data inserted successfully!');
    console.log('🎯 Analytics endpoints should now return meaningful data');

  } catch (error) {
    console.error('\n❌ Error inserting sample data:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  insertSampleData()
    .then(() => {
      console.log('\n✅ All done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Failed:', error.message);
      process.exit(1);
    });
}

module.exports = insertSampleData;
