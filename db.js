// db.js
const mysql = require('mysql2/promise');

// 🚨 ข้อมูลเหล่านี้ควรถูกตั้งค่าเป็น Environment Variables บน Cloud Hosting (เช่น Render.com)
// เพื่อความปลอดภัย ห้าม Push ไฟล์นี้ขึ้น GitHub!
const pool = mysql.createPool({
    host: 'localhost',      
    user: 'root',           
    password: 'your_db_password', 
    database: 'restaurant_db',    
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool;
