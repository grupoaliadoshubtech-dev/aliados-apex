import { useState } from 'react';
export default function EmpresaWizard({ open, onClose }){
  const [step,setStep]=useState(1);
  if(!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur grid place-items-center p-6">
      <div className="w-full max-w-[640px] rounded-[20px] bg-[#0f0f19] border border-white/[0.08] p-6">
        <div className="flex justify-between">
          <h3 className="text-white font-semibold">Configuração da Empresa • Apex SaaS</h3>
          <button onClick={onClose} className="text-white/50">✕</button>
        </div>
        <div className="mt-4 flex gap-2">
          <div className={`h-1 flex-1 rounded-full ${step>=1?'bg-violet-500':'bg-white/10'}`} />
          <div className={`h-1 flex-1 rounded-full ${step>=2?'bg-violet-500':'bg-white/10'}`} />
        </div>
        {step===1 ? (
          <div className="mt-6 space-y-4">
            <div>
              <label className="text-[11px] tracking-widest text-white/40">CNPJ EMITENTE</label>
              <input placeholder="00.000.000/0001-91" className="mt-1 w-full rounded-xl bg-[#14141f] border border-white/10 px-4 py-3 text-white text-sm focus:border-violet-500/50 outline-none" />
              <div className="text-[11px] text-emerald-300/70 mt-1">✓ Busca automática na Receita ativa</div>
            </div>
            <div>
              <label className="text-[11px] tracking-widest text-white/40">RAZÃO SOCIAL</label>
              <input defaultValue="Grupo Aliado Hub Tech LTDA" className="mt-1 w-full rounded-xl bg-[#14141f] border border-white/10 px-4 py-3 text-white text-sm" />
            </div>
            <button onClick={()=>setStep(2)} className="w-full mt-2 py-3 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold">Continuar → Certificado</button>
          </div>
        ) : (
          <div className="mt-6">
            <div className="rounded-xl border border-dashed border-violet-500/30 bg-violet-500/5 p-8 text-center">
              <div className="text-2xl">🔑</div>
              <div className="mt-2 text-white text-sm">Arraste seu certificado A1 .pfx aqui</div>
              <div className="text-[11px] text-white/40 mt-1">Suporte para múltiplos certificados no plano Pro</div>
              <input type="password" placeholder="Senha do .pfx" className="mt-4 w-full max-w-[300px] mx-auto rounded-xl bg-[#14141f] border border-white/10 px-4 py-2.5 text-white text-sm text-center" />
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={()=>setStep(1)} className="px-5 py-2.5 rounded-full bg-white/10 text-white text-sm">Voltar</button>
              <button onClick={onClose} className="flex-1 py-2.5 rounded-full bg-white text-black font-semibold text-sm">Salvar e ativar Apex SaaS</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}