require('dotenv').config();
const express = require('express');
const session = require('express-session');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = 3000; // Necháváme tvoje funkční nastavení

// !! DŮLEŽITÉ: Tohle server potřebuje, aby uměl číst data z administrace
app.use(express.json());

app.use(session({
    secret: 'royal-racing-tajne-heslo',
    resave: false,
    saveUninitialized: false
}));

app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// ŽEBŘÍČEK (Uložený v paměti serveru)
// ==========================================
let leaderboardData = [
    { id: 1, name: "VIKTOR_CZ", wins: 47, podiums: 61, points: 2840 },
    { id: 2, name: "SpeedKing99", wins: 39, podiums: 55, points: 2610 },
    { id: 3, name: "MadMax_SK", wins: 34, podiums: 50, points: 2390 },
    { id: 4, name: "DriftLord", wins: 28, podiums: 44, points: 2100 }
];

// Pošle data žebříčku na web
app.get('/api/leaderboard', (req, res) => {
    res.json(leaderboardData);
});

// Přijme nová data z Administrace a uloží je (ZABEZPEČENO)
app.post('/api/leaderboard', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Nepřihlášen' });
    
    // ======== TADY ZADEJ ID TVÉ DISCORD ROLE ORGANIZÁTORA ========
    const ADMIN_ROLE_ID = '1423786653440540703'; 
    
    if (!req.session.user.roles.includes(ADMIN_ROLE_ID)) {
        return res.status(403).json({ error: 'Nemáš oprávnění' });
    }

    leaderboardData = req.body;
    res.json({ success: true });
});

// ==========================================
// DISCORD PŘIHLÁŠENÍ
// ==========================================

app.get('/auth/discord', (req, res) => {
    const url = `https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}&response_type=code&scope=identify`;
    res.redirect(url);
});

app.get('/auth/discord/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.send('Nebyl poskytnut kód.');

    try {
        const tokenParams = new URLSearchParams({
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: process.env.REDIRECT_URI
        });

        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', tokenParams, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const accessToken = tokenResponse.data.access_token;

        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const user = userResponse.data;

        try {
            const memberResponse = await axios.get(`https://discord.com/api/guilds/${process.env.GUILD_ID}/members/${user.id}`, {
                headers: { Authorization: `Bot ${process.env.BOT_TOKEN}` }
            });
            const roles = memberResponse.data.roles;
            
            req.session.user = {
                id: user.id,
                username: user.username,
                avatar: user.avatar,
                roles: roles
            };
            
            res.redirect('/');
        } catch (err) {
            res.send('Nejsi členem našeho Discord serveru!');
        }
    } catch (error) {
        console.error(error);
        res.send('Chyba při přihlašování.');
    }
});

app.get('/api/user', (req, res) => {
    if (req.session.user) res.json(req.session.user);
    else res.status(401).json({ error: 'Nepřihlášen' });
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.listen(PORT, () => {
    console.log(`🚀 Royal Racing server běží na portu ${PORT}`);
});