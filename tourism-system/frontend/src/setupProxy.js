const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // 只代理以 /api 开头的请求到后端
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:5001',
      changeOrigin: true,
    })
  );
}; 