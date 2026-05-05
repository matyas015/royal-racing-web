require('dotenv').config();
const express = require('express');
const session = require('express-session');
const axios = require('axios');
const path = require('path');

const app = express();
// Pro Railway musí být port dynamický, jinak to občas padá
const PORT = process.env.PORT || 3000;

// !! DŮLEŽITÉ: Tohle server potřebuje, aby uměl číst odeslaná data z Administrace
app.use(express.json());

// Nastavení sessions (aby si web pamatoval, že je uživatel přihlášený)
app.use(session({
    secret: 'royal-racing-tajne-heslo',
    resave: false,
    saveUninitialized: false
}));

// Servírování tvého HTML a CSS ze složky public
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// DATABÁZE ŽEBŘÍČKU (Zatím v paměti serveru)
// ==========================================
let leaderboardData = [
    { id: 1, name: "VIKTOR_CZ", wins: 47, podiums: 61, points: 2840 },
    { id: 2, name: "SpeedKing99", wins: 39, podiums: 55, points: 2610 },
    { id: 3, name: "MadMax_SK", wins: 34, podiums: 50, points: 2390 },
    { id: 4, name: "DriftLord", wins: 28, podiums: 44, points: 2100 }
];

// Pošle data žebříčku komukoliv, kdo si o ně řekne (index.html i admin.html)
app.get('/api/leaderboard', (req, res) => {
    res.json(leaderboardData);
});

// Přijme nová data z Administrace a uloží je (CHRÁNĚNO!)
app.post('/api/leaderboard', (req, res) => {
    // Kontrola 1: Je vůbec přihlášený?
    if (!req.session.user) {
        return res.status(401).json({ error: 'Nepřihlášen' });
    }
    
    // ======== TADY ZADEJ ID TVÉ DISCORD ROLE ORGANIZÁTORA ========
    const ADMIN_ROLE_ID = '1423786653440540703'; 
    
    // Kontrola 2: Má roli organizátora?
    if (!req.session.user.roles.includes(ADMIN_ROLE_ID)) {
        return res.status(403).json({ error: 'Nemáš oprávnění' });
    }

    // Pokud prošel kontrolou, uložíme nová data
    leaderboardData = req.body;
    res.json({ success: true });
});

// ==========================================
// PŘIHLÁŠENÍ A DISCORD LOGIKA
// ==========================================

// 1. KROK: Kliknutí na tlačítko přihlášení
app.get('/auth/discord', (req, res) => {
    const url = `https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}&response_type=code&scope=identify`;
    res.redirect(url);
});

// 2. KROK: Návrat z Discordu na web
app.get('/auth/discord/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.send('Nebyl poskytnut kód.');

    try {
        // Výměna kódu za Access Token
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

        // Získání základních dat o uživateli (jméno, ID)
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const user = userResponse.data;

        // Získání rolí uživatele z TVÉHO serveru pomocí Bota
        try {
            const memberResponse = await axios.get(`https://discord.com/api/guilds/${process.env.GUILD_ID}/members/${user.id}`, {
                headers: { Authorization: `Bot ${process.env.BOT_TOKEN}` }
            });
            const roles = memberResponse.data.roles;
            
            // Uložení do session
            req.session.user = {
                id: user.id,
                username: user.username,
                avatar: user.avatar,
                roles: roles // Tady máme ID všech jeho rolí z Discordu!
            };
            
            res.redirect('/'); // Přesměrování zpět na hlavní stranu
        } catch (err) {
            res.send('Nejsi členem našeho Discord serveru!');
        }

    } catch (error) {
        console.error(error);
        res.send('Chyba při přihlašování.');
    }
});

// API endpoint pro tvůj Frontend, aby si mohl ověřit, kdo je přihlášený
app.get('/api/user', (req, res) => {
    if (req.session.user) {
        res.json(req.session.user);
    } else {
        res.status(401).json({ error: 'Nepřihlášen' });
    }
});

// Zobrazení Administrace (Musí být nad app.listen)
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Odhlášení
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// app.listen musí být VŽDY jako úplně poslední věc v kódu
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Royal Racing server běží na portu ${PORT}`);
});