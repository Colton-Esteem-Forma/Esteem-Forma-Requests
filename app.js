(function(){
const CFG=window.SITE_CONFIG||{},URL_=CFG.SCRIPT_URL,DEMO=!URL_,$=s=>document.querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const STATUSES=["New","In Progress","Completed","Cancelled"];

/* ---------- navigation ---------- */
const view=document.body.dataset.view||"home";
const links=[["index.html","Submit Request","home"],["requests.html","All Requests","all"],["3d-printing.html","3D Printing","3d"],["laser-engraving.html","Laser Engraving","laser"]];
$("#nav").innerHTML=`<div class="bar"><a class="brand" href="index.html">🛠️ ${esc(CFG.SHOP_NAME||"Maker Requests")}</a><nav>`+
links.map(l=>`<a href="${l[0]}" class="${l[2]===view?"on":""}">${l[1]}</a>`).join("")+`</nav></div>`;

/* ---------- data layer (Google Sheet, or browser-only demo mode) ---------- */
const LS="demoRequests";
const demoLoad=()=>{try{return JSON.parse(localStorage.getItem(LS))||[]}catch(e){return[]}};
async function api(body){
  const r=await fetch(URL_,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(body)});
  const j=await r.json(); if(!j.ok) throw new Error(j.error||"Request failed"); return j;
}
async function submitRequest(d){
  if(DEMO){const l=demoLoad();d.id=l.reduce((m,x)=>Math.max(m,+x.id),0)+1;d.submitted=new Date().toISOString();d.status="New";l.push(d);localStorage.setItem(LS,JSON.stringify(l));return d.id}
  return (await api({action:"submit",data:d})).id;
}
async function listRequests(pw){
  if(DEMO) return demoLoad();
  const r=await fetch(URL_+"?password="+encodeURIComponent(pw)); const j=await r.json();
  if(!j.ok) throw new Error(j.error||"error"); return j.rows;
}
async function setStatus(id,status,pw){
  if(DEMO){const l=demoLoad();l.forEach(x=>{if(+x.id===+id)x.status=status});localStorage.setItem(LS,JSON.stringify(l));return}
  await api({action:"update",id,status,password:pw});
}

/* ---------- submit form ---------- */
const form=$("#reqForm");
if(form){
  if(DEMO)$("#demo").innerHTML=`<div class="banner">⚠️ <b>Demo mode:</b> no Google Sheet is connected yet, so requests are saved only in this browser. See README.md (Step 1) to go live.</div>`;
  const due=$("#due");due.min=new Date(Date.now()-new Date().getTimezoneOffset()*6e4).toISOString().slice(0,10);
  const type=()=>{const c=form.querySelector("[name=type]:checked");return c&&c.value};
  form.addEventListener("change",()=>{const t=type();$("#p3d").classList.toggle("show",t==="3D Printing");$("#plaser").classList.toggle("show",t==="Laser Engraving");$("#typeErr").style.display="none"});
  const qp=new URLSearchParams(location.search),EDIT=!DEMO&&qp.get("edit")?{id:qp.get("edit"),t:qp.get("t")||""}:null;
  if(EDIT){document.querySelector("h1").textContent="Edit your request #"+EDIT.id;document.querySelector(".hero p").textContent="Change anything below and save. Edits are possible until we start working on your request.";
    const msg=m=>{$("#formCard").innerHTML="<h2>"+m+"</h2><p class='sub'>Reply to your confirmation email if you need help.</p>"};
    fetch(URL_+"?action=get&id="+encodeURIComponent(EDIT.id)+"&t="+encodeURIComponent(EDIT.t)).then(r=>r.json()).then(j=>{
      if(!j.ok)return msg("Sorry, this edit link isn't valid.");const r=j.row;
      if(r.status!=="New")return msg("We've already started on this request, so it can't be edited here.");
      $("#name").value=r.name;$("#email").value=r.email;$("#need").value=r.need;due.value=r.due;$("#qty").value=r.qty;$("#comments").value=r.comments;
      form.querySelector('[name=type][value="'+r.type+'"]').checked=true;form.dispatchEvent(new Event("change"));
      if(r.type==="3D Printing"){$("#link3d").value=r.link;$("#colors").value=r.colors}else{$("#linkL").value=r.link;$("#etext").value=r.engraving}
      $("#go").textContent="Save Changes"}).catch(()=>msg("Couldn't load your request. Please try again."))}
  const isUrl=v=>{try{return /^https?:$/.test(new URL(v).protocol)}catch(e){return false}};
  const mark=(el,bad)=>{el.classList.toggle("bad",bad);return bad};
  form.addEventListener("submit",async e=>{
    e.preventDefault(); if($("#website").value) return; // spam trap
    const t=type(),v=i=>$(i).value.trim(); let bad=false;
    bad=mark($("#name"),!v("#name"))||bad; bad=mark($("#email"),!/^\S+@\S+\.\S+$/.test(v("#email")))||bad; bad=mark($("#need"),!v("#need"))||bad; bad=mark(due,!due.value)||bad;
    $("#typeErr").style.display=t?"none":"block"; if(!t)bad=true;
    $("#laserErr").style.display="none";
    if(t==="3D Printing"){bad=mark($("#link3d"),!isUrl(v("#link3d")))||bad}
    if(t==="Laser Engraving"){const l=v("#linkL");bad=mark($("#linkL"),!!l&&!isUrl(l))||bad;
      if(!l&&!v("#etext")){$("#laserErr").style.display="block";bad=true}}
    if(bad){const f=form.querySelector(".bad,#typeErr[style*=block],#laserErr[style*=block]");f&&f.scrollIntoView({behavior:"smooth",block:"center"});return}
    const d={name:v("#name"),email:v("#email"),type:t,need:v("#need"),due:due.value,qty:Math.max(1,parseInt($("#qty").value)||1),comments:v("#comments"),
      link:t==="3D Printing"?v("#link3d"):v("#linkL"),colors:t==="3D Printing"?v("#colors"):"",engraving:t==="Laser Engraving"?v("#etext"):""};
    const b=$("#go");b.disabled=true;b.textContent="Sending…";$("#fail").textContent="";
    try{const id=EDIT?(await api({action:"edit",id:EDIT.id,token:EDIT.t,data:d}),EDIT.id):await submitRequest(d);if(EDIT)$("#done h2").textContent="Request updated!";$("#dName").textContent=d.name;$("#dNum").textContent=id;form.style.display="none";$("#done").style.display="block";$("#formCard").scrollIntoView({behavior:"smooth"})}
    catch(err){$("#fail").style.display="block";$("#fail").textContent="Sorry, something went wrong sending your request. Please try again.";b.disabled=false;b.textContent="Submit Request"}
  });
}

/* ---------- request tables ---------- */
const app=$("#app"); if(!app) return;
let pw=sessionStorage.getItem("pw")||"",rows=[],sort={k:"due",dir:1},cols;
const link=u=>/^https?:\/\//i.test(u)?`<a href="${esc(u)}" target="_blank" rel="noopener">Open ↗</a>`:esc(u);
const days=r=>Math.round((new Date(r.due+"T00:00:00")-new Date().setHours(0,0,0,0))/864e5);
const typePill=r=>`<span class="pill ${r.type==="3D Printing"?"t3":"tl"}">${r.type==="3D Printing"?"🧊 3D":"🔥 Laser"}</span>`;
const dueCell=r=>{const d=days(r),open=r.status==="New"||r.status==="In Progress";let b="";
  if(open&&d<0)b=` <span class="pill late">Overdue</span>`;else if(open&&d<=3)b=` <span class="pill soon">${d===0?"Today":"Due soon"}</span>`;return esc(r.due)+b};
const stCell=r=>`<select class="st s-${r.status}" data-id="${r.id}">${STATUSES.map(s=>`<option${s===r.status?" selected":""}>${s}</option>`).join("")}</select>`;
const C={id:["#",r=>"#"+r.id],name:["Name",r=>esc(r.name)],email:["Email",r=>esc(r.email)],type:["Type",typePill],need:["What they need",r=>esc(r.need)],
  link:["Model / Design Link",r=>link(r.link)],engraving:["Engraving Text",r=>esc(r.engraving)],qty:["Qty",r=>esc(r.qty)],colors:["Colors",r=>esc(r.colors)],
  due:["Date Needed",dueCell],comments:["Comments / Instructions",r=>`<td class="c">${esc(r.comments)}</td>`],
  submitted:["Submitted",r=>esc((r.submitted||"").slice(0,10))],status:["Status",stCell]};
const sets={all:["id","name","email","type","need","link","engraving","qty","due","comments","submitted","status"],
  "3d":["id","name","email","need","link","colors","qty","due","comments","status"],laser:["id","name","email","need","link","engraving","qty","due","comments","status"]};
cols=sets[view];

function login(msg){
  app.innerHTML=`<div class="card login"><h2>🔒 Staff login</h2><p class="sub">Enter the password to view requests.</p>
  <input id="pw" type="password" placeholder="Password" autofocus><div class="err" style="display:${msg?"block":"none"}">${esc(msg||"")}</div>
  <button class="btn big" id="lg">View requests</button></div>`;
  const go=()=>{pw=$("#pw").value;load()};$("#lg").onclick=go;$("#pw").addEventListener("keydown",e=>{if(e.key==="Enter")go()});
}
async function load(){
  app.innerHTML=`<div class="empty">Loading…</div>`;
  try{rows=await listRequests(pw);sessionStorage.setItem("pw",pw);draw()}
  catch(e){sessionStorage.removeItem("pw");login(e.message==="auth"?"Wrong password.":"Couldn't load requests. Check config.js and your Apps Script deployment.")}
}
function draw(){
  const scope=rows.filter(r=>view==="all"||(view==="3d")===(r.type==="3D Printing"));
  const n=s=>scope.filter(r=>r.status===s).length;
  app.innerHTML=`${DEMO?`<div class="banner">⚠️ Demo mode: showing requests saved in this browser only.</div>`:""}
  <div class="stats"><div class="stat"><b>${n("New")}</b><span>New</span></div><div class="stat"><b>${n("In Progress")}</b><span>In Progress</span></div>
  <div class="stat"><b>${n("Completed")}</b><span>Completed</span></div><div class="stat"><b>${scope.length}</b><span>Total</span></div></div>
  <div class="tools"><input id="q" type="search" placeholder="Search name, text, comments…"><select id="f"><option value="">All statuses</option><option value="open">Open only (New + In Progress)</option>${STATUSES.map(s=>`<option>${s}</option>`).join("")}</select>
  <button class="btn ghost" id="rf">↻ Refresh</button></div><div class="wrap" id="tb"></div>`;
  $("#q").oninput=$("#f").onchange=table; $("#rf").onclick=load; table();
}
function table(){
  const q=$("#q").value.toLowerCase(),f=$("#f").value;
  let list=rows.filter(r=>(view==="all"||(view==="3d")===(r.type==="3D Printing"))&&
    (!f||(f==="open"?(r.status==="New"||r.status==="In Progress"):r.status===f))&&(!q||JSON.stringify(r).toLowerCase().includes(q)));
  const cl=r=>r.status==="Completed"||r.status==="Cancelled"?1:0;
  list.sort((a,b)=>{if(sort.k==="due"&&cl(a)!==cl(b))return cl(a)-cl(b);const x=a[sort.k],y=b[sort.k];return(sort.k==="id"||sort.k==="qty"?x-y:String(x).localeCompare(String(y)))*sort.dir});
  $("#tb").innerHTML=list.length?`<table><thead><tr>${cols.map(k=>`<th data-k="${k}">${C[k][0]}${sort.k===k?(sort.dir>0?" ▲":" ▼"):""}</th>`).join("")}</tr></thead><tbody>`+
   list.map(r=>"<tr>"+cols.map(k=>{const h=C[k][1](r);return h.startsWith("<td")?h:`<td>${h}</td>`}).join("")+"</tr>").join("")+`</tbody></table>`:`<div class="empty">No requests found.</div>`;
  $("#tb").querySelectorAll("th").forEach(th=>th.onclick=()=>{const k=th.dataset.k;sort=sort.k===k?{k,dir:-sort.dir}:{k,dir:1};table()});
  $("#tb").querySelectorAll("select.st").forEach(s=>s.onchange=async()=>{
    const r=rows.find(x=>+x.id===+s.dataset.id),old=r.status;r.status=s.value;s.className="st s-"+s.value;
    try{await setStatus(r.id,s.value,pw);draw();}catch(e){r.status=old;alert("Couldn't save the change. Please try again.");table()}});
}
pw||DEMO?load():login();
})();
