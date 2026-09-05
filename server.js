// server.js
// Servidor Express SaaS Multi-Tenant - API Leve (Vercel Serverless / Local)
// Refatorado da versão monolítica de 1.553 linhas para arquitetura modular desacoplada

require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs').promises;

const authRoutes = require('./api/routes/auth');
const tenantRoutes = require('./api/routes/tenants');
const batchRoutes = require('./api/routes/batches');
const adminRoutes = require('./api/routes/admin');

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares essenciais
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Log de requisições simplificado
app.use((req, res, next) => {
    if (!req.url.startsWith('/css') && !req.url.startsWith('/js')) {
        console.log(`[API Request] ${req.method} ${req.url}`);
    }
    next();
});

// Arquivos estáticos da interface web
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// REGISTRO DE ROTAS DA API MODULAR
// ==========================================
app.use('/api/auth', authRoutes);
app.use('/api/tenant', tenantRoutes);
app.use('/api/batch', batchRoutes);
app.use('/api/admin', adminRoutes);

// Rotas de download diretas montadas no roteador de lotes
app.use('/api/guide', batchRoutes);
app.use('/api/remessa', batchRoutes);

// Rota de compatibilidade para download de remessa legado
app.get('/download/remessa.txt', async (req, res) => {
    try {
        const localPath = process.env.NODE_ENV === 'production' || process.env.VERCEL
            ? path.join('/tmp', 'remessa.txt')
            : path.join(__dirname, 'remessa.txt');
        await fs.access(localPath);
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', 'attachment; filename="remessa.txt"');
        return res.sendFile(localPath);
    } catch (e) {
        return res.status(404).send("Arquivo remessa.txt não localizado. Processe um lote primeiro.");
    }
});

// Fallback SPA para navegação do frontend
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/download')) {
        return next();
    }
    return res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Inicialização do servidor para ambiente local
if (process.env.NODE_ENV !== 'production' && require.main === module) {
    app.listen(PORT, () => {
        console.log(`\n==================================================`);
        console.log(`🚀 Apex GNRE API Leve rodando localmente na porta ${PORT}`);
        console.log(`🔗 Interface Web: http://localhost:${PORT}`);
        console.log(`👷 Worker de Background: node worker/index.js`);
        console.log(`==================================================\n`);
    });
}

module.exports = app;
