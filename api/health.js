// api/health.js - Health Check Endpoint

module.exports = (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache');
    
    res.json({
        status: 'ok',
        service: 'llUPAT Clan API',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        endpoints: {
            avatar: '/api/avatar?id=DISCORD_USER_ID',
            health: '/api/health'
        }
    });
};
