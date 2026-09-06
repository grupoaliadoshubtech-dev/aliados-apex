export default function Timeline({ step=2 }){
  const items = [
    {k:1, title:'Arquivos lidos', desc:'2.347 XMLs validados', state:'done'},
    {k:2, title:'Guias geradas', desc:'1.842 guias emitidas', state: step>=2 ? 'done' : 'pending'},
    {k:3, title:'Transmissão SEFAZ', desc:'Enviando em lote mTLS', state: step===3 ? 'active' : step>3 ? 'done' : 'pending'},
    {k:4, title:'Remessa Banco', desc:'CNAB 240 Itaú', state: step>=4 ? 'done' : 'pending'},
  ];
  return (
    <div className="max-w-[1100px] mx-auto mt-8 rounded-[20px] bg-[#0f0f19] border border-white/[0.06] p-6 flex gap-8 overflow-auto">
      {items.map((it,i)=>(
        <div key={it.k} className="flex items-center gap-3 min-w-[200px]">
          <div className={`w-8 h-8 rounded-full grid place-items-center text-xs border
            ${it.state==='done' ? 'bg-emerald-400 text-black border-emerald-400' : it.state==='active' ? 'bg-amber-400 text-black border-amber-400 animate-pulse' : 'bg-white/10 text-white/30 border-white/10'}`}>
            {it.state==='done' ? '✓' : it.k}
          </div>
          <div>
            <div className={`text-sm ${it.state==='pending' ? 'text-white/30' : 'text-white'}`}>{it.title}</div>
            <div className="text-[11px] text-white/40">{it.desc}</div>
          </div>
          {i<items.length-1 && <div className="ml-4 w-12 h-px bg-white/10 hidden md:block" />}
        </div>
      ))}
    </div>
  );
}