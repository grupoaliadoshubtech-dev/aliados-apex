// api/utils/encryption.js
// Criptografia simétrica AES-256-CBC para proteção de senhas PFX
// REGRA: NUNCA LOGAR SENHAS OU VALORES DESCRIPTOGRAFADOS

const crypto = require('crypto');

function getEncryptionKey(keyStr) {
    const rawKey = keyStr || process.env.ENCRYPTION_KEY || 'default_32_chars_key_placeholder!';
    return crypto.createHash('sha256').update(String(rawKey)).digest();
}

function encrypt(text, secretKey) {
    if (!text) return null;
    const key = Buffer.isBuffer(secretKey) ? secretKey : getEncryptionKey(secretKey);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text, secretKey) {
    if (!text) return null;
    const key = Buffer.isBuffer(secretKey) ? secretKey : getEncryptionKey(secretKey);
    const parts = text.split(':');
    if (parts.length < 2) {
        throw new Error("Formato de payload criptografado inválido.");
    }
    const iv = Buffer.from(parts.shift(), 'hex');
    const encryptedText = Buffer.from(parts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

module.exports = {
    getEncryptionKey,
    encrypt,
    decrypt
};
