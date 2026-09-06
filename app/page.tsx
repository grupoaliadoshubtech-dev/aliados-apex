'use client';

import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#08080f] text-white font-sans selection:bg-violet-500 selection:text-white">
      {/* HEADER */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#08080f]/80 border-b border-white/[0.06]">
        <div className="max-w-[1280px] mx-auto px-6 h-[72px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 grid place-items-center font-bold text-white shadow-[0_0_20px_rgba(139,92,246,0.3)]">
              A
            </div>
            <div>
              <div className="font-bold text-lg text-white tracking-tight">
                Apex <span className="text-violet-400">SaaS</span>
              </div>
              <div className="text-[10px] text-white/50 -mt-1 tracking-widest uppercase">
                PLATAFORMA DE AUTOMAÇÃO FISCAL
              </div>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm text-white/60">
            <a href="#como-funciona" className="hover:text-white transition-colors">Como Funciona</a>
            <a href="#terminal" className="hover:text-white transition-colors">Terminal</a>
            <a href="#pricing" className="hover:text-white transition-colors">Planos</a>
            <a href="#faq" className="hover:text-white transition-colors">Dúvidas</a>
          </nav>

          <div className="flex items-center gap-4">
            <Link
              href="/login.html"
              className="px-4 py-2 rounded-full border border-white/10 text-xs font-medium text-white/80 hover:text-white hover:bg-white/[0.04] transition-all"
            >
              Entrar
            </Link>
            <Link
              href="/app"
              className="px-5 py-2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-semibold shadow-[0_4px_16px_rgba(99,102,241,0.3)] hover:opacity-95 transition-all"
            >
              Testar Grátis
            </Link>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative pt-24 pb-20 px-6 max-w-[1280px] mx-auto text-center">
        {/* Glow background */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-violet-600/15 blur-[120px] pointer-events-none -z-10 rounded-full" />

        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-medium mb-8">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Automação Fiscal Modular • GNRE • DUA-e • DARF • ICMS-ST Ativos
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-[980px] mx-auto leading-[1.12]">
          Chega de preencher guias fiscais <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-indigo-300 to-purple-400">uma a uma</span>.
        </h1>

        <p className="mt-6 text-base sm:text-lg text-white/50 max-w-[740px] mx-auto leading-relaxed">
          Suba os arquivos XML das suas notas fiscais de venda interestadual. Nossa plataforma conecta-se diretamente à SEFAZ via mTLS, emite as guias, baixa os PDFs originais e gera a remessa de pagamento CNAB 240 para o seu banco de forma totalmente automatizada.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/app"
            className="px-8 py-3.5 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold text-sm shadow-[0_8px_24px_rgba(99,102,241,0.35)] hover:opacity-95 transition-all"
          >
            Iniciar Teste Gratuito →
          </Link>
          <a
            href="#pricing"
            className="px-8 py-3.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-white/80 font-medium text-sm hover:bg-white/[0.08] hover:text-white transition-all"
          >
            Ver Planos de Assinatura
          </a>
        </div>
      </section>

      {/* TERMINAL / MOCKUP SECTION */}
      <section id="terminal" className="px-6 max-w-[1100px] mx-auto pb-24">
        <div className="rounded-[24px] bg-[#0f0f19] border border-white/[0.06] p-6 sm:p-8 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between pb-6 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500/80" />
              <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
              <span className="ml-3 font-mono text-xs text-white/40">pipeline-fiscal.sh</span>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
              ● SEFAZ LIVE mTLS
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-5">
              <div className="w-7 h-7 rounded-full bg-violet-500/20 text-violet-400 grid place-items-center text-xs font-bold mb-3">1</div>
              <h4 className="font-semibold text-sm text-white">Upload em Lote</h4>
              <p className="mt-1 text-xs text-white/50">Arraste centenas de XMLs de NF-e ou CT-e de uma só vez.</p>
              <div className="mt-4 p-3 rounded-lg bg-black/40 border border-dashed border-white/10 text-[11px] font-mono text-white/60 text-center">
                📄 lote_vendas_julho.xml (2.347 notas)
              </div>
            </div>

            <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-5">
              <div className="w-7 h-7 rounded-full bg-violet-500/20 text-violet-400 grid place-items-center text-xs font-bold mb-3">2</div>
              <h4 className="font-semibold text-sm text-white">Processamento mTLS</h4>
              <p className="mt-1 text-xs text-white/50">Comunicação segura com e-CNPJ direto na SEFAZ de destino.</p>
              <div className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-mono text-emerald-300">
                ✔ 14 UFs conectadas<br />✔ Transmissão em lote ok
              </div>
            </div>

            <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-5">
              <div className="w-7 h-7 rounded-full bg-violet-500/20 text-violet-400 grid place-items-center text-xs font-bold mb-3">3</div>
              <h4 className="font-semibold text-sm text-white">Guias + Remessa</h4>
              <p className="mt-1 text-xs text-white/50">Download de PDFs agrupados e TXT bancário para pagamento.</p>
              <div className="mt-4 p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[11px] font-mono text-indigo-300">
                📦 Pacote_Guias.pdf<br />🏦 remessa_cnab240.txt
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING SECTION */}
      <section id="pricing" className="px-6 max-w-[1200px] mx-auto pb-28">
        <div className="text-center max-w-[680px] mx-auto mb-16">
          <div className="text-xs font-semibold tracking-widest text-violet-400 uppercase mb-2">Planos Transparentes</div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Escolha o plano ideal para a sua operação
          </h2>
          <p className="mt-3 text-sm text-white/50">
            Faturamento automatizado via Stripe. Sem fidelidade, cancele a qualquer momento.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* STARTER */}
          <div className="rounded-[24px] bg-[#0f0f19] border border-white/[0.06] p-8 flex flex-col justify-between hover:border-white/15 transition-all">
            <div>
              <div className="text-white font-semibold text-xl">Starter</div>
              <div className="mt-1 text-sm text-white/50">Para quem está começando a vender interestadual</div>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-white">R$ 199</span>
                <span className="text-white/40 text-sm">/mês</span>
              </div>
              <ul className="mt-8 space-y-3">
                {['Até 100 guias por mês', 'Transmissão em lote mTLS', 'Remessas SISPAG CNAB 240', 'Vínculo automático de NFs', 'Suporte por e-mail'].map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-white/70">
                    <span className="text-emerald-400 font-bold">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <Link
              href="/app"
              className="mt-8 w-full py-3 rounded-full bg-white/[0.06] border border-white/10 text-white font-semibold text-sm text-center hover:bg-white/[0.1] transition-all"
            >
              Testar Grátis
            </Link>
          </div>

          {/* PRO (RECOMENDADO) */}
          <div className="relative rounded-[24px] bg-[#11111e] border-2 border-violet-500/40 p-8 flex flex-col justify-between shadow-[0_0_50px_rgba(99,102,241,0.2)]">
            <div className="absolute -top-3.5 right-6 px-3 py-1 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[11px] font-bold tracking-wider uppercase shadow-lg">
              RECOMENDADO
            </div>
            <div>
              <div className="text-white font-semibold text-xl">Pro</div>
              <div className="mt-1 text-sm text-white/50">O plano preferido de marcas e confecções em expansão</div>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-white">R$ 399</span>
                <span className="text-white/40 text-sm">/mês</span>
              </div>
              <ul className="mt-8 space-y-3">
                {['Até 500 guias por mês', 'Transmissão em lote mTLS', 'Remessas SISPAG CNAB 240', 'Suporte a múltiplos certificados', 'Prioridade na fila de emissão', 'Histórico e relatórios fiscais'].map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-white/80">
                    <span className="text-emerald-400 font-bold">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <Link
              href="/app"
              className="mt-8 w-full py-3 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold text-sm text-center shadow-[0_4px_16px_rgba(99,102,241,0.35)] hover:opacity-95 transition-all"
            >
              Testar Grátis
            </Link>
          </div>

          {/* ADVANCED */}
          <div className="rounded-[24px] bg-[#0f0f19] border border-white/[0.06] p-8 flex flex-col justify-between hover:border-white/15 transition-all">
            <div>
              <div className="text-white font-semibold text-xl">Advanced</div>
              <div className="mt-1 text-sm text-white/50">Para indústrias e distribuidoras de alto volume</div>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-white">R$ 699</span>
                <span className="text-white/40 text-sm">/mês</span>
              </div>
              <ul className="mt-8 space-y-3">
                {['Até 1.500 guias por mês', 'Transmissão em lote mTLS', 'Remessas SISPAG CNAB 240', 'APIs dedicadas de webhook', 'Mapeamento fiscal sob medida', 'Suporte prioritário 24/7'].map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-white/70">
                    <span className="text-emerald-400 font-bold">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <Link
              href="/app"
              className="mt-8 w-full py-3 rounded-full bg-white/[0.06] border border-white/10 text-white font-semibold text-sm text-center hover:bg-white/[0.1] transition-all"
            >
              Testar Grátis
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/[0.06] py-12 px-6 text-center text-xs text-white/40">
        <p>Apex SaaS • Plataforma Fiscal Modular • Desenvolvido por Grupo Aliado Hub Tech LTDA</p>
        <p className="mt-1 text-[11px] text-white/20">GNRE • DUA-ES • DARF • ICMS-ST • DIFAL • CNAB 240</p>
      </footer>
    </div>
  );
}
