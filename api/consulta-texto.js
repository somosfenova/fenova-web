const crypto=require('crypto');
const {env,supabaseHeaders,cleanText,trackingFields,notifyTelegram}=require('./_lib');

module.exports=async function handler(req,res){
  if(req.method!=='POST'){
    res.setHeader('Allow','POST');
    return res.status(405).json({ok:false,error:'Método no permitido.'});
  }
  try{
    const name=cleanText(req.body?.name,120);
    const company=cleanText(req.body?.company,160);
    const email=cleanText(req.body?.email,180);
    const message=cleanText(req.body?.message,4000);
    if(!name)return res.status(400).json({ok:false,error:'Falta el nombre.'});
    if(!message)return res.status(400).json({ok:false,error:'Falta la consulta.'});

    const row={
      id:crypto.randomUUID(),
      tipo:'texto',
      nombre:name,
      empresa:company||null,
      email:email||null,
      telefono:null,
      mensaje:message,
      audio_path:null,
      audio_mime_type:null,
      duracion_segundos:null,
      estado:'nueva',
      notas:null,
      valor_cerrado:null,
      ...trackingFields(req.body?.tracking)
    };

    const {url}=env();
    const r=await fetch(`${url}/rest/v1/consultas`,{
      method:'POST',
      headers:supabaseHeaders({'Content-Type':'application/json',Prefer:'return=representation'}),
      body:JSON.stringify(row)
    });
    if(!r.ok){
      console.error(await r.text());
      return res.status(502).json({ok:false,error:'No pudimos registrar la consulta.'});
    }
    await notifyTelegram(row);
    return res.status(200).json({ok:true,id:row.id});
  }catch(e){
    console.error(e);
    return res.status(500).json({ok:false,error:e?.message||'Error interno.'});
  }
};
