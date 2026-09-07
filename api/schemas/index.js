// api/schemas/index.js
// Schemas Zod de validação de dados de entrada para APIs de Auth, Tenant e Stripe

const { z } = require('zod');

const registerSchema = z.object({
    name: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres").optional(),
    email: z.string().trim().email("E-mail com formato inválido"),
    password: z.string().min(6, "A senha deve conter no mínimo 6 caracteres"),
    cnpj: z.string().trim().transform(val => val.replace(/\D/g, '')).refine(val => val.length === 14, "CNPJ deve conter exatamente 14 dígitos numéricos"),
    razao_social: z.string().trim().min(2, "Razão Social é obrigatória"),
    plan: z.enum(['trial', 'starter', 'pro', 'advanced']).optional().default('trial'),
    aceite_termos: z.boolean().refine(val => val === true, "É obrigatório aceitar os Termos de Uso."),
    aceite_privacidade: z.boolean().refine(val => val === true, "É obrigatório aceitar a Política de Privacidade.")
});

const loginSchema = z.object({
    email: z.string().trim().email("E-mail com formato inválido"),
    password: z.string().min(1, "A senha é obrigatória")
});

const tenantSettingsSchema = z.object({
    razao_social: z.string().trim().min(2, "Razão Social é obrigatória"),
    cnpj: z.string().trim().transform(val => val.replace(/\D/g, '')).refine(val => val.length === 14, "CNPJ deve conter 14 dígitos numéricos"),
    bank_agency: z.string().trim().max(4, "Agência Itaú deve ter até 4 dígitos").optional().nullable(),
    bank_account: z.string().trim().max(10, "Conta corrente deve ter até 10 dígitos").optional().nullable(),
    bank_dac: z.string().trim().max(2, "Dígito verificador DAC deve ter até 2 dígitos").optional().nullable(),
    environment: z.enum(['simulado', 'producao', 'homologacao']).optional().default('simulado')
});

const checkoutSessionSchema = z.object({
    plan: z.enum(['starter', 'pro', 'advanced'], {
        errorMap: () => ({ message: "Plano inválido. Use: starter, pro ou advanced." })
    })
});

module.exports = {
    registerSchema,
    loginSchema,
    tenantSettingsSchema,
    checkoutSessionSchema
};
