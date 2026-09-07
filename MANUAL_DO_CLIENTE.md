# 📖 Manual do Usuário — Apex GNRE SaaS
> Guia Oficial de Operação Fiscal e Financeira para Clientes da Plataforma **Grupo Aliados Hub Tech**.

---

## 📑 Sumário

1. [Visão Geral da Solução](#1-visão-geral-da-solução)
2. [Passo 1: Cadastro e Primeiro Acesso](#passo-1-cadastro-e-primeiro-acesso)
3. [Passo 2: Configuração do Certificado Digital A1 (.pfx)](#passo-2-configuração-do-certificado-digital-a1-pfx)
4. [Passo 3: Parametrização da Conta Itaú SISPAG](#passo-3-parametrização-da-conta-itaú-sispag)
5. [Passo 4: Emissão de Guias GNRE em Lote](#passo-4-emissão-de-guias-gnre-em-lote)
6. [Passo 5: Pagamento no Itaú via Remessa CNAB 240](#passo-5-pagamento-no-itaú-via-remessa-cnab-240)
7. [Tabela de Códigos de Receita e Alíquotas GNRE](#tabela-de-códigos-de-receita-e-alíquotas-gnre)
8. [Faturamento, Faturas e Cancelamento](#faturamento-faturas-e-cancelamento)
9. [Perguntas Frequentes (FAQ)](#perguntas-frequentes-faq)

---

## 1. Visão Geral da Solução

O **Apex GNRE** é uma plataforma criada para automatizar o processo de recolhimento de impostos interestaduais para operações de venda ao consumidor final não contribuinte (**DIFAL — Emenda Constitucional 87/2015**) e Fundo de Combate à Pobreza (**FCP**).

Em vez de acessar o Portal Nacional da GNRE ou os portais das SEFAZs estaduais guia por guia, digitando centenas de campos manualmente, a sua empresa simplesmente faz o upload dos **arquivos XML das Notas Fiscais Eletrônicas (NF-e)**. O sistema calcula, assina criptograficamente com seu Certificado Digital A1 e gera:
1. **As Guias GNRE em PDF prontas para impressão** (para acompanhar a mercadoria na transportadora);
2. **O Arquivo de Remessa Bancária Itaú SISPAG CNAB 240** (para que o financeiro pague todas as guias de uma só vez pelo Internet Banking, sem digitar código de barras).

---

## Passo 1: Cadastro e Primeiro Acesso

1. Acesse a página de cadastro corporativo em [http://localhost:3000/register.html](http://localhost:3000/register.html) (ou no seu domínio oficial de produção).
2. Selecione o plano desejado ou inicie no **Trial Gratuito de Avaliação** (com limite de até 10 guias/mês).
3. Informe seu **Nome Completo**, **E-mail Corporativo**, crie uma **Senha Segura** (mínimo de 6 caracteres), o **CNPJ da sua empresa** e a **Razão Social**.
4. Assinale obrigatoriamente os termos da LGPD (**Termos de Uso** e **Política de Privacidade**) e clique em **"Finalizar Cadastro e Começar"**.
5. O sistema enviará imediatamente um e-mail de boas-vindas com as instruções iniciais.

---

## Passo 2: Configuração do Certificado Digital A1 (.pfx)

Para que o sistema possa transmitir e assinar as guias perante as Secretarias de Fazenda dos estados de destino com validade jurídica, é necessário parametrizar o seu **Certificado Digital modelo A1**:

1. No menu superior ou lateral, acesse **"Empresa"** ou **"Configurações"**.
2. No card **"Certificado Digital (A1 .pfx)"**, clique em **"Procurar no computador"**.
3. Selecione o arquivo com extensão `.pfx` ou `.p12` emitido pela sua autoridade certificadora (Certisign, Serasa, Soluti, etc.).
4. Digite a **Senha do Certificado Digital**.
5. Clique em **"Fazer Upload e Salvar Certificado"**.

> 🔒 **Garantia de Segurança Criptográfica:** A senha do seu certificado é gravada com criptografia simétrica forte AES-256 e o arquivo é armazenado em um ambiente de nuvem isolado, exclusivo para o CNPJ da sua empresa. Ele nunca é compartilhado com terceiros.

---

## Passo 3: Parametrização da Conta Itaú SISPAG

Para que o sistema monte o arquivo CNAB 240 que será debitado na sua conta corporativa:

1. Na mesma página de **"Configurações"**, localize a seção **"Dados da Empresa e Conta Débito"**.
2. Preencha:
   * **Agência:** 4 dígitos numéricos (ex: `0334`).
   * **Conta Corrente:** Até 5 dígitos numéricos (ex: `98775`).
   * **Dígito Verificador (DAC):** 1 dígito numérico (ex: `7`).
   * **Ambiente:** Mantenha em *"Homologação / Simulação"* nos primeiros testes; mude para *"Produção Real"* quando for emitir guias oficiais com recolhimento aos cofres públicos.
3. Clique em **"Salvar Configurações"**.

---

## Passo 4: Emissão de Guias GNRE em Lote

O fluxo de emissão é guiado em 4 passos simples:

### Etapa 1: Importar
* No menu lateral, clique em **"Emitir GNRE"**.
* Arraste os arquivos XML das suas notas fiscais de venda interestadual ou selecione um arquivo `.zip` contendo os XMLs.
* O sistema fará a leitura automática dos campos: Chave de Acesso, UF Emitente, UF Favorecida, Valor da NF, Base de Cálculo do DIFAL, Alíquota Interestadual e FCP.

### Etapa 2: Revisar
* O sistema apresentará a tabela de conferência prévia.
* Notas fiscais com cálculo correto recebem a etiqueta verde **PRONTA**.
* Caso haja alguma divergência de inscrição estadual ou CEP, o sistema sinaliza como **REVISAR** para ajuste prévio.

### Etapa 3: Transmissão Oficial
* Confirme a quantidade de guias e o valor total a ser recolhido.
* Clique em **"Emitir guias GNRE"**.
* O sistema estabelecerá conexão segura mTLS com o Portal Nacional da GNRE / SEFAZ do estado de destino.

### Etapa 4: Resultados e Downloads
* Concluída a transmissão, clique em:
  1. **"Baixar Pacote de PDFs (.ZIP)"** — Gera todos os comprovantes e guias em formato PDF pronto para anexo à Nota Fiscal.
  2. **"Baixar Remessa SISPAG (.TXT)"** — Baixa o arquivo de remessa bancária `remessa.txt`.

---

## Passo 5: Pagamento no Itaú via Remessa CNAB 240

Com o arquivo `remessa.txt` baixado:

1. Acesse o **Internet Banking Corporativo do Itaú** com os dados da sua empresa.
2. No menu de navegação, vá para:
   **Transmissão de Arquivos ➔ Enviar Arquivo ➔ SISPAG — Pagamento de Tributos / GNRE**.
3. Selecione o arquivo `remessa.txt` gerado pela plataforma.
4. Clique em **Transmitir**.
5. O sistema do Itaú agendará a liquidação de todas as guias do lote na data de vencimento indicada, debitando da sua conta corrente cadastrada.
6. Não é necessário digitar nenhum código de barras manualmente!

---

## Tabela de Códigos de Receita e Alíquotas GNRE

| Código de Receita | Descrição do Tributo | Quando Utilizar |
|---|---|---|
| **10010-2** | ICMS Consumidor Final Não Contribuinte | Venda interestadual para pessoa física ou jurídica sem Inscrição Estadual (DIFAL EC 87/15). |
| **10008-0** | ICMS Fundo Estadual de Combate à Pobreza | Adicional de alíquota (geralmente 1% a 2%) incidente em mercadorias supérfluas ou definidas por legislação estadual. |
| **10003-0** | ICMS Substituição Tributária por Apuração | Aplicável para contribuintes que possuem Inscrição de Substituto Tributário no estado de destino. |
| **10004-8** | ICMS Substituição Tributária por Operação | Aplicável para recolhimento operação a operação de ICMS-ST sem inscrição prévia no estado de destino. |

---

## Faturamento, Faturas e Cancelamento

A gestão financeira da sua conta é 100% transparente através do **Stripe Billing**:

* **Ver seu Plano e Consumo:** Acesse a tela de **"Empresa"** para ver a cota mensal utilizada vs. contratada.
* **Mudar de Plano (Upgrade/Downgrade):** Acesse a tela de **"Planos"** e selecione o novo plano desejado.
* **Segunda Via de Faturas e Recibos:** Na tela de **"Empresa"**, clique no botão **"Gerenciar Assinatura / Cancelar (Portal Stripe)"**.
* **Trocar Cartão de Crédito:** No Portal Stripe, adicione seu novo cartão corporativo com total segurança.
* **Cancelamento:** Você pode cancelar a qualquer momento no Portal Stripe. Não há fidelidade nem multas rescisórias. O plano permanece ativo até o fim do ciclo mensal já pago.

---

## Perguntas Frequentes (FAQ)

#### 1. Quais estados são atendidos pela emissão automática?
A plataforma atende **todas as 27 Unidades da Federação**. Para os estados conveniados ao Portal Nacional da GNRE (PE, PR, RS, SC, MG, etc.), a transmissão é unificada. Para estados com webservice próprio (como SP e RJ), a plataforma roteia a chamada para a respectiva SEFAZ.

#### 2. O que acontece se a minha cota mensal de guias for atingida?
O sistema emitirá um aviso visual no painel e enviará um e-mail com antecedência. Você poderá fazer o upgrade imediato para um plano superior pagando apenas a diferença proporcional do período.

#### 3. O arquivo de remessa funciona em outros bancos além do Itaú?
O arquivo gerado é padrão **CNAB 240 FEBRABAN para Tributos**, homologado nativamente para o **Itaú SISPAG**. Os formatos Bradesco (PagFor) e Santander estão disponíveis sob consulta mediante solicitação ao suporte.

#### 4. Como falar com o suporte técnico?
Entre em contato diretamente pelos canais oficiais:
* **E-mail de Suporte:** `suporte@aliadohubtech.com.br`
* **Central de Atendimento:** Segunda a sexta, das 09h às 18h (horário de Brasília).
