import { useState } from 'react';
import HeaderPipeline from './HeaderPipeline';
import DropZone from './DropZone';
import PreviewTable from './PreviewTable';
import Timeline from './Timeline';
import UpgradeModal from './UpgradeModal';
import EmpresaWizard from './EmpresaWizard';

export default function AppPipeline(){
  const [files,setFiles]=useState([]);
  const [step,setStep]=useState(1);
  const [upgrade,setUpgrade]=useState(false);
  const [config,setConfig]=useState(false);

  const handleFiles = (f)=>{
    setFiles(f);
    if(f.length>0){ setStep(2); }
  };
  const handleGenerate = ()=> setStep(3);

  return (
    <div className="min-h-screen bg-[#08080f] text-white">
      <HeaderPipeline onUpgrade={()=>setUpgrade(true)} onOpenConfig={()=>setConfig(true)} usage={files.length || 247} />
      {files.length===0 ? (
        <DropZone onFiles={handleFiles} />
      ) : (
        <>
          <PreviewTable count={files.length} onGenerate={handleGenerate} />
          <Timeline step={step} />
        </>
      )}
      <UpgradeModal open={upgrade} onClose={()=>setUpgrade(false)} />
      <EmpresaWizard open={config} onClose={()=>setConfig(false)} />
      <div className="mt-16 text-center text-[11px] text-white/20 pb-8">Apex SaaS • Plataforma Fiscal Modular • Grupo Aliado Hub Tech • sem menção a GNRE - pronto para DARF, ST, DIFAL</div>
    </div>
  );
}