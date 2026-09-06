'use client';

import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="bg-[#08080f] text-white antialiased min-h-screen">
      {/* HEADER */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#08080f]/80 border-b border-white/[0.06]">
        <div className="max-w-[1300px] mx-auto px-6 h-[64px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center font-bold text-white">A</div>
            <div>
              <div className="font-bold text-[18px] leading-none tracking-tight text-white">Apex <span className="bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">SaaS</span></div>
              <div className="text-[9px] tracking-[0.15em] text-white/40 mt-0.5">PLATAFORMA DE AUTOMAÇÃO FISCAL</div>
            </div>
          </div>
          <nav className="hidden lg:flex items-center gap-7 text-[13px] text-white/60">
            <a href="#funcionalidades" className="hover:text-white">Funcionalidades</a>
            <a href="#estados" className="hover:text-white">Estados Atendidos</a>
            <a href="#como" className="hover:text-white">Como Funciona</a>
            <a href="#planos" className="hover:text-white">Planos</a>
            <a href="#faq" className="hover:text-white">Perguntas Frequentes</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login.html" className="px-4 py-2 rounded-full bg-white/[0.06] border border-white/10 text-white/80 text-[13px] hover:bg-white/[0.1]">Entrar</Link>
            <Link href="/app" className="px-5 py-2 rounded-full bg-[#6366f1] hover:bg-[#5558e6] text-white text-[13px] font-semibold">Testar Grátis</Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="max-w-[1100px] mx-auto px-6 pt-20 pb-10 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-[12px] text-violet-300 font-medium">
          <span>⚡</span> Automação Fiscal Modular • GNRE • DUA-e • DARF • ICMS-ST Ativos
        </div>
        <h1 className="mt-8 text-[38px] md:text-[56px] font-extrabold tracking-tight leading-[1.05] text-white">
          Chega de preencher <span className="bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">guias fiscais</span><br/>uma a uma.
        </h1>
        <p className="mt-6 max-w-[720px] mx-auto text-[16px] leading-7 text-white/50">
          Suba os arquivos XML das suas notas fiscais de venda interestadual. Nossa plataforma conecta-se diretamente à SEFAZ via mTLS, emite as guias, baixa os PDFs originais e gera a remessa de pagamento CNAB 240 para o seu banco de forma totalmente automatizada.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/app" className="px-7 py-3 rounded-full bg-[#6366f1] hover:bg-[#5558e6] text-white text-[14px] font-semibold shadow-[0_8px_24px_rgba(99,102,241,0.4)]">Iniciar Teste Gratuito</Link>
          <a href="#planos" className="px-7 py-3 rounded-full bg-white/[0.06] border border-white/10 text-white/80 text-[14px]">Ver Planos de Assinatura</a>
        </div>

        {/* TERMINAL */}
        <div className="max-w-[820px] mx-auto mt-14 rounded-[16px] bg-[#0f0f19] border border-white/[0.06] p-4 text-left">
          <div className="flex items-center gap-2 text-[11px] text-white/40">
            <span className="w-3 h-3 rounded-full bg-red-500/80"></span>
            <span className="w-3 h-3 rounded-full bg-yellow-500/80"></span>
            <span className="w-3 h-3 rounded-full bg-green-500/80"></span>
            <span className="ml-3 font-mono">fluxo-de-automacao.sh — Apex SaaS</span>
          </div>
          <div className="mt-4 font-mono text-[12px] space-y-1">
            <div className="text-white/50"><span className="text-violet-400">$</span> apex process --env=simulado --tributo=auto</div>
            <div className="text-emerald-300/80">✔  2.347 XMLs lidos • 14 UFs detectadas</div>
            <div className="text-emerald-300/80">✔  1.842 guias emitidas (GNRE, DUA-e, DARF)</div>
            <div className="text-white/30">⏳  gerando CNAB 240 Itaú... pronto para SISPAG</div>
          </div>
        </div>
      </section>

      {/* FUNCIONALIDADES */}
      <section id="funcionalidades" className="max-w-[1100px] mx-auto px-6 py-16 grid md:grid-cols-3 gap-6">
        <div className="rounded-[16px] bg-[#0f0f19] border border-white/[0.06] p-6">
          <div className="text-2xl">🏢</div><h3 className="mt-3 font-semibold">Emissão Direta via Web Services</h3>
          <p className="mt-2 text-sm text-white/40">Conexão direta com SEFAZ-ES (DUA-e) e Portal Nacional GNRE via seu certificado A1.</p>
        </div>
        <div className="rounded-[16px] bg-[#0f0f19] border border-white/[0.06] p-6">
          <div className="text-2xl">📄</div><h3 class="mt-3 font-semibold">Download do PDF Oficial</h3>
          <p className="mt-2 text-sm text-white/40">Busca o PDF original da SEFAZ, não HTML cru.</p>
        </div>
        <div className="rounded-[16px] bg-[#0f0f19] border border-white/[0.06] p-6">
          <div className="text-2xl">🏦</div><h3 className="mt-3 font-semibold">Remessa CNAB 240</h3>
          <p className="mt-2 text-sm text-white/40">Gera CNAB 240 padrão Itaú SISPAG para pagar centenas de uma vez.</p>
        </div>
      </section>

      {/* PLANOS */}
      <section id="planos" className="max-w-[1100px] mx-auto px-6 py-20">
        <h2 className="text-center text-3xl font-bold">Planos de Assinatura Simples e Transparentes</h2>
        <div className="mt-10 grid md:grid-cols-3 gap-6">
          <div className="rounded-[20px] p-6 border bg-[#0f0f19] border-white/[0.06]">
            <div className="font-semibold">Starter</div><div className="text-xs text-white/40">Para e-commerces iniciando</div>
            <div className="mt-5"><span className="text-3xl font-bold">R$ 199</span><span className="text-white/40">/mês</span></div>
            <ul className="mt-6 space-y-2 text-[13px] text-white/60"><li>✓ Até 100 guias/mês</li><li>✓ Transmissão mTLS</li><li>✓ CNAB 240</li></ul>
            <Link href="/app" className="mt-6 block text-center py-2.5 rounded-full bg-white text-black text-sm font-semibold">Selecionar Starter</Link>
          </div>
          <div className="relative rounded-[20px] p-6 border bg-[#12121f] border-emerald-400/30 shadow-[0_0_40px_rgba(16,185,129,0.15)]">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-400 text-black text-[10px] font-bold px-3 py-1 rounded-full">RECOMENDADO</div>
            <div className="font-semibold">Pro</div><div className="text-xs text-white/40">Marcas em crescimento</div>
            <div className="mt-5"><span className="text-3xl font-bold">R$ 399</span><span className="text-white/40">/mês</span></div>
            <ul className="mt-6 space-y-2 text-[13px] text-white/60"><li>✓ Até 500 guias/mês</li><li>✓ Múltiplos CNPJs</li><li>✓ Suporte &lt;4h</li></ul>
            <Link href="/app" className="mt-6 block text-center py-2.5 rounded-full bg-emerald-400/15 text-emerald-300 border border-emerald-400/20 text-sm font-semibold">Selecionar Pro</Link>
          </div>
          <div className="rounded-[20px] p-6 border bg-[#0f0f19] border-white/[0.06]">
            <div className="font-semibold">Advanced</div><div className="text-xs text-white/40">Operações robustas</div>
            <div className="mt-5"><span className="text-3xl font-bold">R$ 699</span><span className="text-white/40">/mês</span></div>
            <ul className="mt-6 space-y-2 text-[13px] text-white/60"><li>✓ Até 1.500 guias/mês</li><li>✓ APIs dedicadas</li><li>✓ Suporte Premium 24/7</li></ul>
            <Link href="/app" className="mt-6 block text-center py-2.5 rounded-full bg-white text-black text-sm font-semibold">Selecionar Advanced</Link>
          </div>
        </div>
        <div className="mt-10 text-center text-[11px] text-white/30">Taxa única de setup e homologação bancária: R$ 600,00 • Pagamento seguro via Stripe • Cancele quando quiser</div>
      </section>

      <footer className="border-t border-white/[0.06] py-10 text-center text-[11px] text-white/20">
        Apex SaaS • Plataforma de Automação Fiscal Modular • Grupo Aliado Hub Tech LTDA • 2026<br/>
        <span className="text-white/10">GNRE • DUA-e • DARF • ICMS-ST • DIFAL - Detectado automaticamente</span>
      </footer>
    </div>
  );
}
