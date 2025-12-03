// db.js
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: 'localhost',      
    user: 'root',           
    password: 'your_db_password', // <<<< แก้ไขรหัสผ่านของคุณ
    database: 'restaurant_db',    
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool;
