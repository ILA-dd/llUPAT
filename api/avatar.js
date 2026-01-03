// api/avatar.js - Discord Avatar Proxy
// Токен хранится в Vercel Environment Variables, НЕ в коде!

const ALLOWED_ORIGINS = [
    'https://llupat.ru',
    'https://www.llupat.ru',
    'https://llupat.vercel.app',
    'https://llupat-clan.vercel.app',
    'http://localhost:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500'
];

// Rate limiting
const requestCounts = new Map();
const RATE_LIMIT = 60;
const RATE_WINDOW = 60000;

function isRateLimited(ip) {
    const now = Date.now();
    const data = requestCounts.get(ip) || { count: 0, resetTime: now + RATE_WINDOW };
    
    if (now > data.resetTime) {
        data.count = 1;
        data.resetTime = now + RATE_WINDOW;
    } else {
        data.count++;
    }
    
    requestCounts.set(ip, data);
    
    if (requestCounts.size > 1000) {
        for (const [key, val] of requestCounts) {
            if (now > val.resetTime) requestCounts.delete(key);
        }
    }
    
    return data.count > RATE_LIMIT;
}

function getDefaultAvatar(userId) {
    try {
        const index = Number(BigInt(userId) >> BigInt(22)) % 6;
        return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
    } catch {
        return `https://cdn.discordapp.com/embed/avatars/0.png`;
    }
}

module.exports = async (req, res) => {
    // CORS
    const origin = req.headers.origin || req.headers.referer || '';
    const isAllowed = ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed));
    
    res.setHeader('Access-Control-Allow-Origin', isAllowed ? origin : ALLOWED_ORIGINS[0]);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    // Rate limiting
    const clientIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
    
    if (isRateLimited(clientIP)) {
        res.setHeader('Retry-After', '60');
        return res.status(429).json({ error: 'Too many requests', retryAfter: 60 });
    }
    
    // Validation
    const userId = req.query.id;
    const size = parseInt(req.query.size) || 256;
    
    if (!userId || !/^\d{17,19}$/.test(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    if (size < 16 || size > 4096) {
        return res.status(400).json({ error: 'Invalid size' });
    }
    
    // ТОКЕН БЕРЁТСЯ ИЗ ENVIRONMENT VARIABLES VERCEL
    const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
    
    if (!BOT_TOKEN) {
        console.warn('[Avatar API] DISCORD_BOT_TOKEN not configured');
        return res.json({
            userId,
            avatarUrl: getDefaultAvatar(userId),
            isDefault: true,
            error: 'Service not configured'
        });
    }
    
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(`https://discord.com/api/v10/users/${userId}`, {
            headers: {
                'Authorization': `Bot ${BOT_TOKEN}`,
                'Content-Type': 'application/json'
            },
            signal: controller.signal
        });
        
        clearTimeout(timeout);
        
        if (response.ok) {
            const user = await response.json();
            let avatarUrl;
            
            if (user.avatar) {
                const ext = user.avatar.startsWith('a_') ? 'gif' : 'png';
                avatarUrl = `https://cdn.discordapp.com/avatars/${userId}/${user.avatar}.${ext}?size=${size}`;
            } else {
                avatarUrl = getDefaultAvatar(userId);
            }
            
            res.setHeader('Cache-Control', 'public, max-age=3600');
            
            return res.json({
                userId,
                username: user.username,
                globalName: user.global_name,
                avatar: user.avatar,
                avatarUrl,
                isDefault: !user.avatar
            });
        } else {
            return res.json({
                userId,
                avatarUrl: getDefaultAvatar(userId),
                isDefault: true,
                error: `Discord API: ${response.status}`
            });
        }
    } catch (error) {
        return res.json({
            userId,
            avatarUrl: getDefaultAvatar(userId),
            isDefault: true,
            error: error.name === 'AbortError' ? 'Timeout' : error.message
        });
    }
};
