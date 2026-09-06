import { useState } from 'react';

export default function HeaderPipeline({ usage = 247, limit = 500, onUpgrade, onOpenConfig }) {
  const pct = Math.min(100, (usage/limit)*100);
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#08080f]/80 border-b border-white/[0.06]">
      <div className="max-w-[1400px] mx-auto px-6 h-[64px] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 grid place-items-center font-bold text-white">A</div>
          <div>
            <div className="font-semibold text-white tracking-tight">Apex <span className="text-violet-300">SaaS</span></div>
            <div className="text-[10px] text-white/50 -mt-1 tracking-widest">PLATAFORMA FISCAL</div>
          </div>
          <div className="ml-6 hidden md:flex items-center gap-2 text-xs">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-white/60">AO VIVO</span>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-2 bg-white/[0.04] border border-white/[0.06] rounded-full p-1">
          <div className="px-3 py-1 rounded-full bg-white text-black text-xs font-medium">1. Importar</div>
          <div className="px-3 py-1 text-xs text-white/40">2. Validar</div>
          <div className="px-3 py-1 text-xs text-white/40">3. Emitir</div>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-2.5 py-1 rounded-full bg-amber-400/15 text-amber-300 border border-amber-400/20 text-[11px] font-medium">🧪 SIMULADO</span>
          <div className="hidden md:block h-6 w-px bg-white/10" />
          <div className="hidden md:flex items-center gap-3">
            <div className="text-right">
              <div className="text-[11px] text-white/70">Grupo Aliado Hub Tech LTDA</div>
              <div className="text-[10px] text-white/40">00.000.000/0001-91 • {usage}/{limit}</div>
              <div className="w-[120px] h-1 bg-white/10 rounded-full mt-1 overflow-hidden">
                <div className="h-full bg-violet-500" style={{width: pct+'%'}} />
              </div>
            </div>
            <button onClick={onUpgrade} className="px-3 py-1.5 rounded-full bg-white text-black text-xs font-semibold hover:bg-zinc-200">Upgrade</button>
            <button onClick={onOpenConfig} className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/10 grid place-items-center text-white/70 hover:text-white">⚙️</button>
          </div>
        </div>
      </div>
    </header>
  );
}