const http = require('http');
const fs = require('fs');
const path = require('path');
const PORT = process.env.PORT || 10000;
const DATA_FILE = process.env.DATA_FILE || './data/licenses.json';
const ADMIN_SECRET = process.env.ADMIN_SECRET;
let licenses = {};
function load(){try{licenses=JSON.parse(fs.readFileSync(DATA_FILE,'utf8'))}catch{licenses={}}}
function save(){fs.mkdirSync(path.dirname(DATA_FILE),{recursive:true});fs.writeFileSync(DATA_FILE,JSON.stringify(licenses,null,2))}
function send(res,status,obj){res.writeHead(status,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type, X-Admin-Secret','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Cache-Control':'no-store'});res.end(JSON.stringify(obj))}
function body(req){return new Promise((resolve,reject)=>{let s='';req.on('data',c=>s+=c);req.on('end',()=>{try{resolve(JSON.parse(s||'{}'))}catch(e){reject(e)}})})}
function key(){return 'SKY-'+require('crypto').randomBytes(8).toString('hex').toUpperCase()}
load();
http.createServer(async(req,res)=>{
 if(req.method==='OPTIONS')return send(res,200,{});
 const url=new URL(req.url,'http://localhost');
 // Serve the browser-based admin page and a friendly homepage.
 if(req.method==='GET'&&(url.pathname==='/'||url.pathname==='/admin.html')){
  try{const html=fs.readFileSync(path.join(__dirname,'admin.html'),'utf8');res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return res.end(html)}
  catch{return send(res,500,{error:'admin page missing'})}
 }
 if(url.pathname==='/health')return send(res,200,{ok:true});
 if(req.method==='POST'&&url.pathname==='/api/check'){
  try{const b=await body(req),l=licenses[String(b.key||'').toUpperCase()];const now=Date.now();const active=!!(l&&l.active&&(!l.expiresAt||now<l.expiresAt)&&(!l.deviceId||l.deviceId===b.deviceId));
   if(active&&!l.deviceId){l.deviceId=b.deviceId;save()}
   return send(res,200,{active,message:active?'active':'license invalid, expired, revoked, or bound to another device'});
  }catch{return send(res,400,{active:false,message:'bad request'})}
 }
 if(url.pathname.startsWith('/api/admin/')){
  if(!ADMIN_SECRET||req.headers['x-admin-secret']!==ADMIN_SECRET)return send(res,401,{error:'Unauthorized'});
  if(req.method==='GET'&&url.pathname==='/api/admin/licenses')return send(res,200,{licenses});
  if(req.method==='POST'&&url.pathname==='/api/admin/create'){
   const b=await body(req),k=key(),days=Math.max(0,Number(b.days)||0);licenses[k]={active:true,createdAt:Date.now(),expiresAt:days?Date.now()+days*86400000:null,deviceId:null,note:String(b.note||'').slice(0,100)};save();return send(res,200,{key:k,license:licenses[k]});
  }
  if(req.method==='POST'&&url.pathname==='/api/admin/toggle'){
   const b=await body(req),k=String(b.key||'').toUpperCase();if(!licenses[k])return send(res,404,{error:'not found'});licenses[k].active=!!b.active;save();return send(res,200,{ok:true,license:licenses[k]});
  }
  if(req.method==='POST'&&url.pathname==='/api/admin/unbind'){
   const b=await body(req),k=String(b.key||'').toUpperCase();if(!licenses[k])return send(res,404,{error:'not found'});licenses[k].deviceId=null;save();return send(res,200,{ok:true});
  }
 }
 return send(res,404,{error:'not found'});
}).listen(PORT,()=>console.log('license server listening on '+PORT));
