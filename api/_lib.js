const crypto = require('crypto');

function env() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Supabase no está configurado en Vercel.');
  return { url: url.replace(/\/+$/, ''), key };
}
function supabaseHeaders(extra = {}) {
  const { key } = env();
  return { apikey:key, Authorization:`Bearer ${key}`, ...extra };
}
function cleanText(value,max=500){return String(value||'').trim().slice(0,max)}
function safeEqual(a,b){
  const aa=Buffer.from(String(a||'')),bb=Buffer.from(String(b||''));
  if(aa.length!==bb.length)return false;
  return crypto.timingSafeEqual(aa,bb);
}
function parseCookies(req){
  const cookies={};
  String(req.headers.cookie||'').split(';').forEach(part=>{
    const i=part.indexOf('=');if(i<0)return;
    const k=part.slice(0,i).trim(),v=part.slice(i+1).trim();
    if(k)cookies[k]=decodeURIComponent(v);
  });
  return cookies;
}
function authSecret(){
  const s=process.env.ADMIN_CONSULTAS_PASSWORD||'';
  if(!s)throw new Error('ADMIN_CONSULTAS_PASSWORD no está configurada.');
  return s;
}
function signSession(exp){
  const payload=String(exp);
  const signature=crypto.createHmac('sha256',authSecret()).update(`fenova-admin:${payload}`).digest('base64url');
  return `${payload}.${signature}`;
}
function verifySession(token){
  const [expRaw]=String(token||'').split('.');
  const exp=Number(expRaw);
  if(!exp||Date.now()>exp)return false;
  return safeEqual(signSession(exp),token);
}
function makeSessionCookie(){
  const exp=Date.now()+12*60*60*1000;
  return `fenova_admin=${encodeURIComponent(signSession(exp))}; Path=/; Max-Age=43200; HttpOnly; Secure; SameSite=Lax`;
}
function clearSessionCookie(){return 'fenova_admin=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax'}
function requireAdmin(req,res){
  try{if(verifySession(parseCookies(req).fenova_admin))return true}catch{}
  res.status(401).json({ok:false,error:'Sesión vencida o no autorizada.'});return false;
}
function audioExtension(mime){
  const m=String(mime||'').toLowerCase();
  if(m.includes('mp4')||m.includes('m4a'))return 'm4a';
  if(m.includes('ogg'))return 'ogg';
  if(m.includes('mpeg')||m.includes('mp3'))return 'mp3';
  if(m.includes('wav'))return 'wav';
  return 'webm';
}
function makeUploadSession(id,path){
  const {key}=env(),exp=Date.now()+2*60*60*1000,body=`${exp}|${id}|${path}`;
  return `${exp}.${crypto.createHmac('sha256',key).update(body).digest('base64url')}`;
}
function verifyUploadSession(token,id,path){
  const [expRaw,sig]=String(token||'').split('.'),exp=Number(expRaw);
  if(!exp||!sig||Date.now()>exp)return false;
  const {key}=env(),body=`${exp}|${id}|${path}`;
  return safeEqual(sig,crypto.createHmac('sha256',key).update(body).digest('base64url'));
}
function trackingFields(input={}){
  const t=input&&typeof input==='object'?input:{};
  return {
    utm_source:cleanText(t.utm_source,160)||null,
    utm_medium:cleanText(t.utm_medium,160)||null,
    utm_campaign:cleanText(t.utm_campaign,260)||null,
    utm_content:cleanText(t.utm_content,260)||null,
    utm_term:cleanText(t.utm_term,260)||null,
    gclid:cleanText(t.gclid,500)||null,
    fbclid:cleanText(t.fbclid,500)||null,
    referrer:cleanText(t.referrer,1200)||null,
    landing_url:cleanText(t.landing_url,1600)||null,
  };
}
async function notifyTelegram(row){
  const token=process.env.TELEGRAM_BOT_TOKEN||'';
  const chatId=process.env.TELEGRAM_CHAT_ID||'';
  if(!token||!chatId)return;
  const source=row.utm_source||'directo';
  const type=row.tipo==='audio'?`🎙 Audio ${row.duracion_segundos||0}s`:'✍️ Texto';
  const lines=[
    '🔔 Nueva consulta FENOVA',
    '',
    `👤 ${row.nombre||'Sin nombre'}`,
    row.empresa?`🏢 ${row.empresa}`:null,
    row.telefono?`📱 ${row.telefono}`:null,
    row.email?`✉️ ${row.email}`:null,
    `📌 ${type}`,
    `📣 Origen: ${source}`,
    row.utm_campaign?`🎯 Campaña: ${row.utm_campaign}`:null,
    row.mensaje?`💬 ${String(row.mensaje).slice(0,500)}`:null,
    '',
    'admin.fenova.com.ar'
  ].filter(Boolean);
  try{
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({chat_id:chatId,text:lines.join('\n')})
    });
  }catch(e){console.error('Telegram notification error:',e)}
}
module.exports={
  env,supabaseHeaders,cleanText,safeEqual,parseCookies,authSecret,
  makeSessionCookie,clearSessionCookie,requireAdmin,audioExtension,
  makeUploadSession,verifyUploadSession,trackingFields,notifyTelegram
};
