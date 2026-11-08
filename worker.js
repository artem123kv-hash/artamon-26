/**
 * CHKA API starter. Configure ADMIN_TOKEN with `wrangler secret put ADMIN_TOKEN`.
 * Not production-ready: connect authenticated Artamon identities, durable match
 * rooms, realtime updates, WebRTC signaling and server-authoritative match results.
 */
const cors={"access-control-allow-origin":"*","access-control-allow-headers":"content-type,authorization","access-control-allow-methods":"GET,POST,OPTIONS"};
const json=(x,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{...cors,"content-type":"application/json; charset=utf-8"}});
export default {async fetch(req,env){
 const u=new URL(req.url);if(req.method==="OPTIONS")return new Response(null,{headers:cors});
 if(u.pathname==="/health")return json({ok:true,service:"chka-api",version:"0.1"});
 if(u.pathname.startsWith("/admin/")){const t=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");if(!env.ADMIN_TOKEN||t!==env.ADMIN_TOKEN)return json({error:"Unauthorized"},401);}
 if(u.pathname==="/admin/status"&&req.method==="GET"){
  const tour=await env.DB.prepare("SELECT id,name,status,created_at FROM tournaments ORDER BY created_at DESC LIMIT 1").first();
  if(!tour)return json({status:"idle",tournament:null,matches:[],playerCount:0});
  const ms=await env.DB.prepare("SELECT id,round,clan_a,clan_b,status,winner_clan FROM matches WHERE tournament_id=? ORDER BY created_at").bind(tour.id).all();
  const pc=await env.DB.prepare("SELECT COUNT(*) n FROM registrations WHERE tournament_id=?").bind(tour.id).first();
  return json({status:tour.status,tournament:tour,matches:(ms.results||[]).map(m=>({id:m.id,round:m.round,clanA:m.clan_a,clanB:m.clan_b,status:m.status,winner:m.winner_clan})),playerCount:pc?.n||0});
 }
 if(u.pathname==="/admin/tournament/start"&&req.method==="POST"){
  const b=await req.json().catch(()=>({}));const clans=[...new Set((b.clans||[]).map(x=>String(x).trim()).filter(Boolean))];
  if(clans.length<2)return json({error:"Нужно минимум два разных клана"},400);
  const id=crypto.randomUUID(),now=Date.now();
  await env.DB.prepare("INSERT INTO tournaments(id,name,status,created_at) VALUES(?,?,?,?)").bind(id,"ЧКА "+new Date(now).toLocaleDateString("ru-RU"),"running",now).run();
  if(clans.length===2)await env.DB.prepare("INSERT INTO matches(id,tournament_id,round,clan_a,clan_b,status,created_at) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(),id,"final",clans[0],clans[1],"waiting",now).run();
  else return json({error:"Для турнира из более чем двух кланов сначала настройте схему посева; турнир не должен стартовать частично."},400);
  return json({ok:true,tournamentId:id,message:"Финал создан. Подключение игроков и рассылка старта ещё требуют realtime-клиента."});
 }
 if(u.pathname==="/admin/tournament/stop"&&req.method==="POST"){
  const t=await env.DB.prepare("SELECT id FROM tournaments WHERE status='running' ORDER BY created_at DESC LIMIT 1").first();if(!t)return json({error:"Нет активного турнира"},404);
  await env.DB.prepare("UPDATE tournaments SET status='stopped' WHERE id=?").bind(t.id).run();return json({ok:true,message:"Турнир остановлен"});
 }
 return json({error:"Not found"},404);
}};
