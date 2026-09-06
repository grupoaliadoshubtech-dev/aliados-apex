import { useCallback, useState } from 'react';

export default function DropZone({ onFiles }) {
  const [drag, setDrag] = useState(false);
  const handleDrop = useCallback((e)=>{
    e.preventDefault(); setDrag(false);
    const files = Array.from(e.dataTransfer.files || []);
    onFiles?.(files);
  },[onFiles]);

  return (
    <div className="max-w-[1100px] mx-auto mt-12">
      <div
        onDragOver={(e)=>{e.preventDefault(); setDrag(true)}}
        onDragLeave={()=>setDrag(false)}
        onDrop={handleDrop}
        className={`relative rounded-[24px] border bg-[#10101a] p-12 text-center transition-all
        ${drag ? 'border-violet-500/60 shadow-[0_0_40px_rgba(99,102,241,0.25)] scale-[1.01]' : 'border-dashed border-white/15 hover:border-violet-500/30 hover:bg-[#13131f]'}`}
      >
        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 grid place-items-center text-2xl mb-5 shadow-[0_8px_24px_rgba(99,102,241,0.35)]">📥</div>
        <h2 className="text-[28px] font-semibold text-white tracking-tight">Arraste seus arquivos fiscais aqui</h2>
        <p className="mt-2 text-sm text-white/50">XML de NF-e, CT-e ou pasta completa • Processamento em lote • Até 5.000 arquivos</p>

        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          <label className="px-5 py-2.5 rounded-full bg-white text-black text-sm font-semibold cursor-pointer hover:bg-zinc-100">
            Selecionar arquivos
            <input type="file" multiple accept=".xml" className="hidden" onChange={(e)=>onFiles?.(Array.from(e.target.files||[]))} />
          </label>
          <button onClick={()=>onFiles?.(Array(2347).fill({name:'NFe_exemplo.xml'}))} className="px-5 py-2.5 rounded-full bg-white/[0.06] border border-white/10 text-white/80 text-sm hover:bg-white/[0.10]">Usar arquivos de exemplo</button>
        </div>

        <div className="mt-10 grid grid-cols-3 gap-4 text-left max-w-[720px] mx-auto">
          {[
            ['⚡','Processamento em lote mTLS','Transmissão automática para SEFAZ'],
            ['🏦','Remessa SISPAG CNAB 240','Pronto para Itaú e outros bancos'],
            ['🔗','Vínculo automático de NFs','Sem digitação manual']
          ].map(([icon,title,desc])=>(
            <div key={title} className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
              <div className="text-lg">{icon}</div>
              <div className="mt-2 text-[13px] font-medium text-white">{title}</div>
              <div className="text-[11px] text-white/40 mt-1 leading-snug">{desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 text-center text-[11px] text-white/30">Suporta: .xml • .zip • pastas • Apex SaaS detecta automaticamente o tributo</div>
    </div>
  );
}