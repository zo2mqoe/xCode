// server.js
const express = require('express');
const http = require('http'); 
const { Server } = require('socket.io');
const bodyParser = require('body-parser');
const db = require('./db'); 

const app = express();
const server = http.createServer(app);
// 🚨 ตั้งค่า CORS ให้ยอมรับโดเมนสาธารณะของคุณ (เช่น GitHub Pages)
const io = new Server(server, {
    cors: {
        origin: "*", // ควรเปลี่ยนเป็นโดเมน GitHub Pages จริงของคุณ เช่น https://zo2mqoe.github.io
        methods: ["GET", "POST"]
    }
});
const port = process.env.PORT || 3000; // ใช้ Port ที่ Cloud Hosting กำหนดให้

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public')); 

// API 1: ดึงเมนูทั้งหมด
app.get('/api/menu', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT item_id, name, description, price FROM items WHERE is_available = TRUE');
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching menu:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// API 2: รับคำสั่งซื้อใหม่ (พร้อม Transaction และ Real-Time Notification)
app.post('/api/order', async (req, res) => {
    const { table_number, items } = req.body;
    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction(); 

        let total_amount = 0;
        for (const item of items) {
             const [itemData] = await connection.query('SELECT price FROM items WHERE item_id = ?', [item.item_id]);
             if (itemData.length === 0) throw new Error(`Item ID ${item.item_id} not found.`);
             total_amount += itemData[0].price * item.quantity;
        }

        const [orderResult] = await connection.query(
            'INSERT INTO orders (table_number, order_time, status, total_amount) VALUES (?, NOW(), ?, ?)',
            [table_number, 'PENDING', total_amount]
        );
        const order_id = orderResult.insertId;

        const detailPromises = items.map(async (item) => {
            const [itemData] = await connection.query('SELECT price FROM items WHERE item_id = ?', [item.item_id]);
            const subtotal = itemData.length > 0 ? itemData[0].price * item.quantity : 0;
            return connection.query(
                'INSERT INTO order_details (order_id, item_id, quantity, notes, subtotal) VALUES (?, ?, ?, ?, ?)',
                [order_id, item.item_id, item.quantity, item.notes || '', subtotal]
            );
        });
        await Promise.all(detailPromises);

        await connection.commit(); 

        // ส่งสัญญาณ Real-Time ไปยังหน้าจอครัว (KDS)
        const [newOrderDetails] = await db.query(
            `SELECT od.quantity, od.notes, i.name AS item_name 
             FROM order_details od JOIN items i ON od.item_id = i.item_id
             WHERE od.order_id = ?`, [order_id]
        );
        
        const newOrder = { 
            order_id, 
            table_number, 
            total_amount, 
            items: newOrderDetails, 
            status: 'PENDING', 
            order_time: new Date().toLocaleTimeString('th-TH') 
        };
        io.emit('new_order', newOrder); 

        res.status(201).json({ success: true, message: 'ได้รับคำสั่งซื้อแล้ว', order_id, total_amount });

    } catch (error) {
        if (connection) await connection.rollback(); 
        console.error('Error processing order:', error.message);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการบันทึกคำสั่งซื้อ' });
    } finally {
        if (connection) connection.release();
    }
});

// API 3: อัปเดตสถานะ (สำหรับหน้าครัว)
app.post('/api/order/status', async (req, res) => {
    const { order_id, status } = req.body;
    try {
        await db.query('UPDATE orders SET status = ? WHERE order_id = ?', [status, order_id]);
        
        io.emit('order_status_update', { order_id, status }); 

        res.json({ success: true, message: `อัปเดตสถานะ Order ${order_id} เป็น ${status}` });
    } catch (error) {
        console.error('Error updating status:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Socket.io Connection
io.on('connection', (socket) => {
    console.log(`A client connected: ${socket.id}`);
});

// เริ่ม Server
server.listen(port, () => {
    console.log(`✅ Server is running on port ${port}`);
});
