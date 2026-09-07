// api/middlewares/validate.js
// Middleware genérico para validação de payloads Express via schemas Zod

function validateBody(schema) {
    return (req, res, next) => {
        try {
            const parsed = schema.parse(req.body);
            req.body = parsed; // substitui pelo body higienizado e tipado
            next();
        } catch (err) {
            if (err && err.issues) {
                const message = err.issues.map(e => e.message).join('; ');
                return res.status(400).json({
                    error: message || 'Dados de entrada inválidos.',
                    details: err.issues
                });
            }
            return res.status(400).json({ error: err.message || 'Payload inválido.' });
        }
    };
}

module.exports = { validateBody };
