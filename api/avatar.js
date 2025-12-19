module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    const userId = req.query.id;
    const size = parseInt(req.query.size) || 256;
    
    if (!userId || !/^\d{17,19}$/.test(userId)) {
        return res.status(400).json({ 
            error: 'Invalid user ID. Use ?id=123456789012345678' 
        });
    }
    
    const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
    
    // Если нет токена - возвращаем дефолтный аватар
    if (!BOT_TOKEN) {
        const index = Number(BigInt(userId) >> BigInt(22)) % 6;
        return res.json({
            userId,
            avatarUrl: `https://cdn.discordapp.com/embed/avatars/${index}.png`,
            isDefault: true,
            error: 'Bot token not configured'
        });
    }
    
    try {
        const response = await fetch(`https://discord.com/api/v10/users/${userId}`, {
            headers: {
                'Authorization': `Bot ${BOT_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const user = await response.json();
            let avatarUrl;
            
            if (user.avatar) {
                // Реальный аватар: https://cdn.discordapp.com/avatars/{user_id}/{avatar_hash}.png
                const ext = user.avatar.startsWith('a_') ? 'gif' : 'png';
                avatarUrl = `https://cdn.discordapp.com/avatars/${userId}/${user.avatar}.${ext}?size=${size}`;
            } else {
                // Дефолтный аватар
                const index = Number(BigInt(userId) >> BigInt(22)) % 6;
                avatarUrl = `https://cdn.discordapp.com/embed/avatars/${index}.png`;
            }
            
            return res.json({
                userId,
                username: user.username,
                globalName: user.global_name,
                avatar: user.avatar,
                avatarUrl,
                isDefault: !user.avatar
            });
        } else {
            // Discord API ошибка
            const index = Number(BigInt(userId) >> BigInt(22)) % 6;
            return res.json({
                userId,
                avatarUrl: `https://cdn.discordapp.com/embed/avatars/${index}.png`,
                isDefault: true,
                error: `Discord API: ${response.status}`
            });
        }
    } catch (error) {
        // Ошибка сети
        const index = Number(BigInt(userId) >> BigInt(22)) % 6;
        return res.json({
            userId,
            avatarUrl: `https://cdn.discordapp.com/embed/avatars/${index}.png`,
            isDefault: true,
            error: error.message
        });
    }
};
