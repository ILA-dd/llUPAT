module.exports = (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({
        status: 'ok',
        service: 'Discord Avatar Proxy',
        version: '1.0.0'
    });
};
