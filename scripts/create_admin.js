// scripts/create_admin.js
// Script utilitário para criar um novo Tenant e Administrador Master no Supabase

require('dotenv').config();
const readline = require('readline');
const { supabaseAdmin, createScopedClient } = require('../api/utils/supabase');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function ask(question, defaultVal = '') {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer.trim() || defaultVal);
        });
    });
}

async function main() {
    console.log("==================================================");
    console.log("👑 CRIAR NOVO USUÁRIO ADMINISTRADOR (APEX GNRE)");
    console.log("==================================================");

    // Aceita argumentos via CLI: node scripts/create_admin.js <email> <senha> <nome> <cnpj> <razao_social>
    const args = process.argv.slice(2);

    let email = args[0];
    let password = args[1];
    let name = args[2];
    let cnpj = args[3];
    let razaoSocial = args[4];

    if (!email) {
        email = await ask("📧 Digite o E-mail do Administrador: ");
    }
    if (!password) {
        password = await ask("🔑 Digite a Senha (mínimo 6 caracteres): ");
    }
    if (!name) {
        name = await ask("👤 Nome do Administrador: ", "Admin Master");
    }
    if (!cnpj) {
        cnpj = await ask("🏢 CNPJ da Empresa (apenas números, ou enter para padrão): ", "00000000000191");
    }
    if (!razaoSocial) {
        razaoSocial = await ask("🏢 Razão Social da Empresa: ", "Empresa Administradora");
    }

    rl.close();

    if (!email || !password || password.length < 6) {
        console.error("❌ E-mail e senha válida (mínimo 6 caracteres) são obrigatórios.");
        process.exit(1);
    }

    const cleanCnpj = cnpj.replace(/[^0-9]/g, '');

    try {
        console.log("\n1. Verificando/Criando Tenant da Empresa...");
        let tenantId = null;

        // Verifica se já existe tenant com este CNPJ
        const { data: existingTenant } = await supabaseAdmin
            .from('tenants')
            .select('id, razao_social')
            .eq('cnpj', cleanCnpj)
            .single();

        if (existingTenant) {
            tenantId = existingTenant.id;
            console.log(`ℹ Empresa já existente encontrada: ${existingTenant.razao_social} (ID: ${tenantId})`);
        } else {
            let insertPayload = {
                cnpj: cleanCnpj,
                razao_social: razaoSocial,
                bank_agency: '0001',
                bank_account: '00001',
                bank_dac: '0',
                environment: 'simulado',
                subscription_status: 'ativo'
            };

            let { data: newTenant, error: tenantErr } = await supabaseAdmin
                .from('tenants')
                .insert(insertPayload)
                .select()
                .single();

            if (tenantErr || !newTenant) {
                throw new Error("Falha ao criar Tenant: " + (tenantErr?.message || 'Erro desconhecido'));
            }
            tenantId = newTenant.id;
            console.log(`✔ Nova empresa cadastrada com sucesso! (ID: ${tenantId})`);
        }

        console.log("\n2. Criando credenciais no Supabase Auth...");
        // Se o usuário já existir no Auth, vamos atualizar a senha
        let userId = null;
        const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true
        });

        if (authErr) {
            if (authErr.message && authErr.message.includes('already been registered')) {
                console.log("ℹ E-mail já registrado no Auth. Buscando ID do usuário para atualizar senha e privilégios...");
                const { data: usersList } = await supabaseAdmin.auth.admin.listUsers();
                const found = usersList.users.find(u => u.email.toLowerCase() === email.toLowerCase());
                if (found) {
                    userId = found.id;
                    await supabaseAdmin.auth.admin.updateUserById(userId, {
                        password,
                        email_confirm: true
                    });
                    console.log("✔ Senha do usuário atualizada com sucesso no Supabase Auth.");
                } else {
                    throw authErr;
                }
            } else {
                throw authErr;
            }
        } else {
            userId = authUser.user.id;
            console.log(`✔ Usuário criado com sucesso no Auth! (ID: ${userId})`);
        }

        console.log("\n3. Configurando perfil com permissão de Administrador (is_admin: true)...");
        const { error: profileErr } = await supabaseAdmin
            .from('profiles')
            .upsert({
                id: userId,
                tenant_id: tenantId,
                email,
                name,
                is_admin: true
            }, { onConflict: 'id' });

        if (profileErr) {
            throw new Error("Falha ao configurar perfil de admin: " + profileErr.message);
        }

        console.log("\n4. Testando autenticação das novas credenciais...");
        const client = createScopedClient(null);
        const { data: loginData, error: loginErr } = await client.auth.signInWithPassword({
            email,
            password
        });

        if (loginErr) {
            throw new Error("Falha na validação do login recém-criado: " + loginErr.message);
        }

        console.log("\n==================================================");
        console.log("🎉 ADMINISTRADOR CRIADO COM SUCESSO!");
        console.log("==================================================");
        console.log(`📧 E-mail:      ${email}`);
        console.log(`🔑 Senha:       [Definida]`);
        console.log(`👤 Nome:        ${name}`);
        console.log(`🏢 Empresa:     ${razaoSocial} (CNPJ: ${cleanCnpj})`);
        console.log(`⭐ Privilégio:  ADMINISTRADOR MASTER (is_admin: true)`);
        console.log(`💎 Plano:       Advanced (10.000 guias/mês - Ativo)`);
        console.log("==================================================");
        console.log("Você já pode fazer login na aplicação com essas credenciais!");

    } catch (err) {
        console.error("\n❌ Erro ao criar administrador:", err.message);
        process.exit(1);
    }
}

main();
