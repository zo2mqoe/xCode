const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const passport = require('passport');
const { Strategy } = require('passport-discord');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// --- 1. ตั้งค่า DISCORD BOT ---
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

client.on('ready', () => {
    console.log(`✅ บอทออนไลน์แล้วในชื่อ: ${client.user.tag}`);
});

// ใส่ TOKEN ผ่าน Environment Variable ใน Render
client.login(process.env.BOT_TOKEN);

// --- 2. ตั้งค่า PASSPORT (DISCORD LOGIN) ---
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new Strategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL, // https://paffpig.onrender.com/callback
    scope: ['identify', 'guilds']
}, (accessToken, refreshToken, profile, done) => {
    process.nextTick(() => done(null, profile));
}));

app.use(session({
    secret: 'paffpig-secret-key',
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

// ให้ Express เข้าถึงไฟล์ในโฟลเดอร์ public
app.use(express.static(path.join(__dirname, 'public')));

// --- 3. ROUTES ---
app.get('/login', passport.authenticate('discord'));

app.get('/callback', passport.authenticate('discord', {
    failureRedirect: '/'
}), (req, res) => {
    res.redirect('/');
});

app.get('/api/user', (req, res) => {
    if (!req.user) return res.json(null);
    
    // กรองเฉพาะเซิร์ฟเวอร์ที่ User เป็น Owner หรือ Admin
    const manageableGuilds = req.user.guilds.filter(g => {
        const isAdmin = (BigInt(g.permissions) & BigInt(0x8)) === BigInt(0x8);
        return g.owner || isAdmin;
    });

    res.json({
        username: req.user.username,
        avatar: `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png`,
        guilds: manageableGuilds
    });
});

app.get('/logout', (req, res) => {
    req.logout(() => res.redirect('/'));
});

app.listen(PORT, () => {
    console.log(`🚀 เว็บไซต์รันที่พอร์ต: ${PORT}`);
});
