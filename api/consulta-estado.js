const {env,supabaseHeaders,requireAdmin,cleanText}=require('./_lib');

module.exports=async function handler(req,res){
  if(req.method!=='POST'){
    res.setHeader('Allow','POST');
    return res.status(405).json({ok:false,error:'Método no permitido.'});
  }
  if(!requireAdmin(req,res))return;
  try{
    const id=cleanText(req.body?.id,80);
    const estado=cleanText(req.body?.estado,40);
    const notas=cleanText(req.body?.notas,4000);
    const allowed=['nueva','contactada','presupuestada','ganada','perdida','cerrada'];
    if(!id)return res.status(400).json({ok:false,error:'Falta id.'});
    if(!allowed.includes(estado))return res.status(400).json({ok:false,error:'Estado inválido.'});
    let valor=null;
    if(req.body?.valor_cerrado!==''&&req.body?.valor_cerrado!=null){
      const n=Number(req.body.valor_cerrado);
      if(Number.isFinite(n)&&n>=0)valor=n;
    }
    const {url}=env();
    const r=await fetch(`${url}/rest/v1/consultas?id=eq.${encodeURIComponent(id)}`,{
      method:'PATCH',
      headers:supabaseHeaders({'Content-Type':'application/json',Prefer:'return=minimal'}),
      body:JSON.stringify({estado,notas:notas||null,valor_cerrado:valor})
    });
    if(!r.ok){
      console.error(await r.text());
      return res.status(502).json({ok:false,error:'No pudimos actualizar la consulta.'});
    }
    return res.status(200).json({ok:true});
  }catch(e){
    return res.status(500).json({ok:false,error:e?.message||'Error interno.'});
  }
};
