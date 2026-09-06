export default function UpgradeModal({ open, onClose, current='pro' }){
  if(!open) return null;
  const plans = [
    {id:'starter', name:'Starter', price:'199', limit:'100', feats:['Até 100 guias por mês','Transmissão em lote mTLS','Remessas SISPAG CNAB 240','Vínculo automático de NFs','Painel unificado']},
    {id:'pro', name:'Pro', price:'399', limit:'500', badge:'RECOMENDADO', feats:['Até 500 guias por mês','Transmissão em lote mTLS','Remessas SISPAG CNAB 240','Suporte a múltiplos certificados','Tempo de resposta prioritário','Histórico expandido'], active:true},
    {id:'advanced', name:'Advanced', price:'699', limit:'1.500', feats:['Até 1.500 guias por mês','Transmissão em lote mTLS','Remessas SISPAG CNAB 240','APIs dedicadas','Mapeamento avançado','Suporte Premium 24/7']},
  ];
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md grid place-items-center p-6">
      <div className="w-full max-w-[1100px]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-white">Planos Apex SaaS</h2>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/10 text-white grid place-items-center">✕</button>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map(p=>(
            <div key={p.id} className={`relative rounded-[20px] p-6 border ${p.badge ? 'bg-[#11111d] border-emerald-400/30 shadow-[0_0_40px_rgba(16,185,129,0.15)]' : 'bg-[#0f0f19] border-white/[0.06]'}`}>
              {p.badge && <div className="absolute -top-3 -right-3 rotate-12 bg-violet-600 text-white text-[10px] font-bold px-3 py-1 rounded-full">{p.badge}</div>}
              <div className="text-white font-semibold text-lg">{p.name}</div>
              <div className="mt-1 text-sm text-white/50">{p.id==='starter'?'Para e-commerces iniciando': p.id==='pro'?'Marcas em crescimento':'Operações robustas'}</div>
              <div className="mt-6 flex items-end gap-1"><span className="text-4xl font-bold text-white">R$ {p.price}</span><span className="text-white/40 text-sm mb-1">/mês</span></div>
              <ul className="mt-6 space-y-2.5">
                {p.feats.map(f=><li key={f} className="flex gap-2 text-[13px] text-white/70"><span className="text-emerald-400">✓</span>{f}</li>)}
              </ul>
              <button className={`mt-6 w-full py-2.5 rounded-full text-sm font-semibold ${p.active ? 'bg-emerald-400/15 text-emerald-300 border border-emerald-400/20' : 'bg-white text-black hover:bg-zinc-100'}`}>
                {p.active ? '✓ Plano Ativo' : `Selecionar ${p.name}`}
              </button>
            </div>
          ))}
        </div>
        <div className="mt-4 text-center text-[11px] text-white/30">Faturamento via Stripe • Cancele quando quiser • Apex SaaS não é só GNRE, é fiscal completo</div>
      </div>
    </div>
  );
}