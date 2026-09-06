export default function PreviewTable({ count=2347, onGenerate }) {
  const rows = [
    {nfe:'000234', emit:'Loja Aliados LTDA', uf:'SP', trib:'ICMS-ST', valor:'R$ 89,40', status:'Pronto'},
    {nfe:'000235', emit:'Aliados Fashion', uf:'RJ', trib:'DIFAL', valor:'R$ 124,10', status:'Pronto'},
    {nfe:'000236', emit:'Hub Tech Confecções', uf:'BA', trib:'FCP', valor:'R$ 12,30', status:'Pronto'},
    {nfe:'000237', emit:'Grupo Aliado', uf:'MG', trib:'ICMS-ST', valor:'R$ 210,00', status:'Validando'},
  ];
  return (
    <div className="max-w-[1400px] mx-auto mt-8 grid grid-cols-12 gap-6">
      <div className="col-span-12 lg:col-span-8 rounded-[20px] bg-[#0f0f19] border border-white/[0.06] overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div>
            <h3 className="text-white font-semibold">{count.toLocaleString('pt-BR')} notas detectadas • R$ 1.2M em base • 14 UFs</h3>
            <p className="text-xs text-white/40 mt-1">Revise antes de emitir • Apex SaaS agrupou por UF automaticamente</p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-emerald-400/15 text-emerald-300 text-xs border border-emerald-400/20">14 grupos fiscais</span>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-[13px]">
            <thead className="text-[11px] tracking-widest text-white/30">
              <tr className="border-b border-white/[0.06]">
                <th className="text-left font-normal px-6 py-3">NF-e</th>
                <th className="text-left font-normal">Emitente</th>
                <th className="text-left font-normal">UF Dest.</th>
                <th className="text-left font-normal">Tributo</th>
                <th className="text-left font-normal">Valor</th>
                <th className="text-left font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r=>(
                <tr key={r.nfe} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-6 py-3 text-white/80">{r.nfe}</td>
                  <td className="text-white/60">{r.emit}</td>
                  <td><span className="px-2 py-0.5 rounded bg-white/[0.06] border border-white/10 text-white/70 text-xs">{r.uf}</span></td>
                  <td className="text-white/60">{r.trib}</td>
                  <td className="text-white">{r.valor}</td>
                  <td><span className="text-emerald-300 text-xs">● {r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 bg-[#0c0c14] border-t border-white/[0.06] flex items-center justify-between">
          <span className="text-xs text-white/50">3 UFs selecionadas • Total: R$ 4.382,10 em guias</span>
          <button onClick={onGenerate} className="px-5 py-2.5 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-semibold shadow-[0_8px_20px_rgba(99,102,241,0.35)] hover:opacity-90">Gerar Guias e Remessa →</button>
        </div>
      </div>

      <div className="col-span-12 lg:col-span-4 space-y-4">
        <div className="rounded-[20px] bg-[#10101b] border border-violet-500/20 p-5 shadow-[0_0_30px_rgba(99,102,241,0.12)]">
          <div className="text-xs tracking-widest text-white/40">RESUMO DA OPERAÇÃO</div>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-white/50">Notas</span><span className="text-white">{count}</span></div>
            <div className="flex justify-between"><span className="text-white/50">Base total</span><span className="text-white">R$ 1.247.890,00</span></div>
            <div className="flex justify-between"><span className="text-white/50">Guias a emitir</span><span className="text-white">1.842</span></div>
            <div className="flex justify-between"><span className="text-white/50">Banco</span><span className="text-white">Itaú • CNAB 240</span></div>
          </div>
          <div className="mt-5 h-px bg-white/10" />
          <button className="mt-4 w-full py-2.5 rounded-full bg-white text-black text-sm font-semibold">Baixar Pacote (PDF + CNAB)</button>
          <div className="mt-2 text-[11px] text-white/30 text-center">Pronto para SISPAG</div>
        </div>

        <div className="rounded-[20px] bg-black border border-white/10 p-4 font-mono text-[11px] text-white/50">
          <div className="text-white/30 mb-2">$ terminal</div>
          <div className="text-emerald-300/80">$ apex process --files={count} --env=simulado</div>
          <div>✔  {count} XMLs lidos</div>
          <div>✔  14 UFs agrupadas</div>
          <div className="text-amber-300/70">⏳  transmitindo SEFAZ...</div>
        </div>
      </div>
    </div>
  );
}