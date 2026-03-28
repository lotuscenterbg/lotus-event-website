import { useState, useRef, useEffect, useMemo } from "react";

const DAYS = ["Понедельник", "Среда", "Пятница"];
const DAY_KEYS = ["mon", "wed", "fri"];
const MAX = 20;
const ADMIN_PASS = "ttadmin123";
const POINTS = { 1: 3, 2: 2, 3: 1 };
const MEDAL = ["🥇", "🥈", "🥉"];

// ── helpers ────────────────────────────────────────────────────────────────────

function getNextDates() {
  const today = new Date();
  const dow = today.getDay();
  return [1, 3, 5].map((t) => {
    const d = new Date(today);
    let diff = t - dow;
    if (diff < 0) diff += 7;
    d.setDate(today.getDate() + diff);
    return d;
  });
}
function fmt(date) { return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" }); }
function fmtShort(s) { return new Date(s).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }); }
function tKey(dk, date) { return `${dk}_${date.toISOString().slice(0, 10)}`; }
function dateFromKey(k) { return k.split("_")[1]; }
function dayLabelFromKey(k) { const i = DAY_KEYS.indexOf(k.split("_")[0]); return i >= 0 ? DAYS[i] : k; }

function normalizePhone(raw) {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("8") && digits.length === 11) return "7" + digits.slice(1);
  if (digits.startsWith("7") && digits.length === 11) return digits;
  return digits;
}
function formatPhoneDisplay(digits) {
  if (!digits) return "";
  if (digits.length === 11 && digits.startsWith("7"))
    return `+7 (${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7,9)}-${digits.slice(9)}`;
  return "+" + digits;
}

// ── storage ────────────────────────────────────────────────────────────────────

const STORE = "ttcvarna_v4";
function loadStore() { try { return JSON.parse(localStorage.getItem(STORE) || "{}"); } catch { return {}; } }
function saveStore(s) { localStorage.setItem(STORE, JSON.stringify(s)); }
function initStore(raw) { return { players: raw.players || {}, tournaments: raw.tournaments || {} }; }

function getLeaderboard(store) {
  const scores = {}, wins = {};
  Object.values(store.tournaments).forEach(t => {
    if (!t.results) return;
    [1,2,3].forEach(place => {
      const phone = t.results[place]; if (!phone) return;
      const name = (store.players[phone] || {}).name || phone;
      scores[name] = (scores[name] || 0) + POINTS[place];
      wins[name] = wins[name] || {1:0,2:0,3:0};
      wins[name][place]++;
    });
  });
  return Object.entries(scores).sort((a,b)=>b[1]-a[1]).map(([name,pts])=>({name,pts,wins:wins[name]}));
}

function getTournamentHistory(store) {
  return Object.entries(store.tournaments)
    .filter(([,v]) => v.results)
    .sort((a,b) => b[0].localeCompare(a[0])).slice(0,30)
    .map(([key,val]) => ({
      key, date: dateFromKey(key), day: dayLabelFromKey(key),
      results: Object.fromEntries(Object.entries(val.results).map(([pl,phone]) =>
        [pl, phone ? (store.players[phone]||{}).name||phone : ""]))
    }));
}

// ── NamePicker ─────────────────────────────────────────────────────────────────

function NamePicker({ options, value, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);
  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const filtered = useMemo(() => options.filter(o => o.toLowerCase().includes(q.toLowerCase())), [options, q]);
  return (
    <div ref={ref} style={{ position:"relative" }}>
      <div style={{...NP.box,...(open?NP.boxOpen:{})}} onClick={() => { setOpen(v=>!v); setQ(""); }}>
        <span style={{flex:1,opacity:value?1:0.35}}>{value||placeholder}</span>
        <span style={{opacity:0.4,fontSize:12}}>{open?"▲":"▼"}</span>
      </div>
      {open && (
        <div style={NP.dropdown}>
          <input autoFocus style={NP.search} placeholder="Поиск..." value={q}
            onChange={e=>setQ(e.target.value)} onClick={e=>e.stopPropagation()} />
          <div style={NP.list}>
            <div style={NP.item} onClick={()=>{onChange("");setOpen(false);setQ("");}}>
              <span style={{opacity:0.35}}>— не указывать —</span>
            </div>
            {filtered.length===0 && <div style={{...NP.item,opacity:0.35}}>Не найдено</div>}
            {filtered.map(name=>(
              <div key={name} style={{...NP.item,...(name===value?NP.itemActive:{})}}
                onClick={()=>{onChange(name);setOpen(false);setQ("");}}>
                {name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
const NP = {
  box:{display:"flex",alignItems:"center",background:"rgba(255,255,255,0.09)",border:"1px solid rgba(255,255,255,0.18)",borderRadius:12,padding:"12px 14px",cursor:"pointer",color:"#fff",fontSize:15},
  boxOpen:{borderColor:"rgba(255,215,0,0.5)"},
  dropdown:{position:"absolute",top:"calc(100% + 6px)",left:0,right:0,background:"#1e1b3a",border:"1px solid rgba(255,255,255,0.15)",borderRadius:14,zIndex:100,overflow:"hidden",boxShadow:"0 12px 40px rgba(0,0,0,0.6)"},
  search:{width:"100%",boxSizing:"border-box",background:"rgba(255,255,255,0.07)",border:"none",borderBottom:"1px solid rgba(255,255,255,0.1)",padding:"10px 14px",color:"#fff",fontSize:14,outline:"none"},
  list:{maxHeight:200,overflowY:"auto"},
  item:{padding:"10px 14px",cursor:"pointer",fontSize:14,color:"#fff"},
  itemActive:{background:"rgba(255,215,0,0.12)",color:"#ffd200"},
};

// ── ConfirmButton — inline confirm without confirm() dialog ────────────────────

function ConfirmButton({ onConfirm, label = "✕", confirmLabel = "Удалить?", style }) {
  const [pending, setPending] = useState(false);
  const timer = useRef(null);
  function handleClick(e) {
    e.stopPropagation();
    if (pending) { onConfirm(); setPending(false); clearTimeout(timer.current); }
    else {
      setPending(true);
      timer.current = setTimeout(() => setPending(false), 3000);
    }
  }
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <button style={{...style, ...(pending?{color:"#e84343",fontWeight:700,fontSize:12,border:"1px solid rgba(232,67,67,0.4)",borderRadius:8,padding:"3px 8px"}:{})}}
      onClick={handleClick}>
      {pending ? confirmLabel : label}
    </button>
  );
}

// ── App ────────────────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView] = useState("home");
  const [selDay, setSelDay] = useState(null);
  const [selDate, setSelDate] = useState(null);
  const [store, setStore] = useState(() => initStore(loadStore()));

  // registration
  const [phoneRaw, setPhoneRaw] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isKnown, setIsKnown] = useState(false);
  const [success, setSuccess] = useState(false);

  // self-cancel
  const [cancelPhone, setCancelPhone] = useState("");
  const [cancelResults, setCancelResults] = useState(null); // [{tKey, dayLabel, date, name}]

  // admin
  const [adminKey, setAdminKey] = useState("");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminError, setAdminError] = useState(false);
  const [adminTab, setAdminTab] = useState("registrations");
  const [resultsKey, setResultsKey] = useState(null);
  const [resultsDraft, setResultsDraft] = useState({1:"",2:"",3:""});
  const [editPhone, setEditPhone] = useState(null);
  const [editName, setEditName] = useState("");

  const dates = getNextDates();

  function persist(s) { setStore(s); saveStore(s); }
  function getTournament(key) { return store.tournaments[key] || {}; }
  function getRegs(dk, date) { return getTournament(tKey(dk,date)).registrations || []; }

  function handlePhoneChange(raw) {
    setPhoneRaw(raw);
    const norm = normalizePhone(raw);
    if (norm.length >= 10) {
      const player = store.players[norm];
      if (player) {
        const parts = player.name.split(" ");
        setFirstName(parts[0]||""); setLastName(parts.slice(1).join(" ")||"");
        setIsKnown(true); return;
      }
    }
    setIsKnown(false);
  }

  function register() {
    const phone = normalizePhone(phoneRaw);
    if (phone.length < 10) return;
    const first = firstName.trim(), last = lastName.trim();
    if (!first||!last) return;
    const key = tKey(selDay, selDate);
    const existing = getTournament(key).registrations || [];
    if (existing.length >= MAX) return;
    if (existing.find(r => r.phone === phone)) { alert("Этот номер уже зарегистрирован."); return; }
    const fullName = `${first} ${last}`;
    const newPlayers = {...store.players};
    if (!newPlayers[phone]) newPlayers[phone] = {name:fullName, firstSeen:new Date().toISOString()};
    persist({
      ...store, players: newPlayers,
      tournaments: {...store.tournaments, [key]: {...getTournament(key), registrations:[...existing,{phone,name:fullName,time:new Date().toLocaleString("ru-RU")}]}}
    });
    setSuccess(true);
  }

  function removeReg(key, idx) {
    const regs = (getTournament(key).registrations||[]).filter((_,i)=>i!==idx);
    persist({...store, tournaments:{...store.tournaments,[key]:{...getTournament(key),registrations:regs}}});
  }

  function updateTournament(key, patch) {
    persist({...store, tournaments:{...store.tournaments,[key]:{...getTournament(key),...patch}}});
  }

  function saveResults(key) {
    updateTournament(key, {results:{...resultsDraft}});
    setView("admin"); setResultsKey(null);
  }

  function savePlayerName(phone) {
    persist({...store, players:{...store.players,[phone]:{...store.players[phone],name:editName.trim()}}});
    setEditPhone(null);
  }

  function deletePlayer(phone) {
    const {[phone]:_,...rest} = store.players;
    persist({...store, players:rest});
  }

  // self-cancel: look up all upcoming registrations by phone
  function lookupCancel() {
    const phone = normalizePhone(cancelPhone);
    if (phone.length < 10) return;
    const upcoming = dates.map((d,i) => {
      const key = tKey(DAY_KEYS[i], d);
      const regs = getTournament(key).registrations || [];
      const found = regs.find(r => r.phone === phone);
      if (!found) return null;
      return {key, dayLabel:DAYS[i], date:fmt(d), name:found.name};
    }).filter(Boolean);
    setCancelResults(upcoming);
  }

  function cancelRegistration(key, phone) {
    const regs = (getTournament(key).registrations||[]).filter(r=>r.phone!==phone);
    persist({...store, tournaments:{...store.tournaments,[key]:{...getTournament(key),registrations:regs}}});
    setCancelResults(prev => prev.filter(r=>r.key!==key));
  }

  function goHome() {
    setView("home"); setSuccess(false);
    setPhoneRaw(""); setFirstName(""); setLastName(""); setIsKnown(false);
    setCancelPhone(""); setCancelResults(null);
  }

  const leaderboard = getLeaderboard(store);
  const history = getTournamentHistory(store);
  const allPlayerNames = useMemo(()=>Object.values(store.players).map(p=>p.name).sort(),[store.players]);

  // ── CANCEL VIEW ────────────────────────────────────────────────────────────

  if (view === "cancel") {
    return (
      <div style={S.page}>
        <div style={{...S.card,maxWidth:420}}>
          <button style={S.back} onClick={goHome}>← Назад</button>
          <div style={{textAlign:"center",marginBottom:24}}>
            <div style={{fontSize:44}}>📵</div>
            <h2 style={S.h2}>Отменить запись</h2>
            <p style={{...S.sub,marginTop:4}}>Введите свой номер телефона</p>
          </div>

          <label style={S.label}>Номер телефона</label>
          <input style={S.input} type="tel" placeholder="+7 999 000 00 00"
            value={cancelPhone} onChange={e=>{setCancelPhone(e.target.value);setCancelResults(null);}}
            onKeyDown={e=>e.key==="Enter"&&lookupCancel()} />
          <button style={{...S.btnPrimary,opacity:normalizePhone(cancelPhone).length>=10?1:0.4}}
            onClick={lookupCancel} disabled={normalizePhone(cancelPhone).length<10}>
            Найти мои записи →
          </button>

          {cancelResults !== null && (
            <div style={{marginTop:20}}>
              {cancelResults.length === 0 ? (
                <div style={{textAlign:"center",opacity:0.45,padding:"20px 0"}}>
                  <div style={{fontSize:32}}>🔍</div>
                  <p>Активных записей не найдено</p>
                </div>
              ) : (
                <>
                  <p style={{fontSize:13,opacity:0.5,marginBottom:12}}>Ваши предстоящие записи:</p>
                  {cancelResults.map(r=>(
                    <div key={r.key} style={S.cancelCard}>
                      <div>
                        <div style={{fontWeight:700,fontSize:16}}>{r.dayLabel}</div>
                        <div style={{opacity:0.5,fontSize:13,marginTop:2}}>{r.date}</div>
                        <div style={{fontSize:13,marginTop:4,color:"rgba(255,255,255,0.7)"}}>{r.name}</div>
                      </div>
                      <ConfirmButton
                        label="Отменить"
                        confirmLabel="Подтвердить?"
                        onConfirm={()=>cancelRegistration(r.key, normalizePhone(cancelPhone))}
                        style={S.btnCancelReg}
                      />
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── REGISTER ───────────────────────────────────────────────────────────────

  if (view === "register" && selDay !== null) {
    const regs = getRegs(selDay, selDate);
    const isFull = regs.length >= MAX;
    const dayLabel = DAYS[DAY_KEYS.indexOf(selDay)];
    const pct = regs.length / MAX;
    const phone = normalizePhone(phoneRaw);
    const phoneOk = phone.length >= 10;
    const canSubmit = phoneOk && firstName.trim() && lastName.trim();

    return (
      <div style={S.page}>
        <div style={S.card}>
          <button style={S.back} onClick={goHome}>← Назад</button>
          <div style={S.regHeader}>
            <span style={{fontSize:40}}>🏓</span>
            <div>
              <h2 style={{...S.h2,textAlign:"left",marginBottom:2}}>{dayLabel}</h2>
              <p style={{...S.sub,textAlign:"left"}}>{fmt(selDate)}</p>
            </div>
          </div>
          <div style={S.progressWrap}>
            <div style={{...S.progressBar,width:`${pct*100}%`,background:pct>=1?"#e84343":pct>0.7?"#f7971e":"#2ecc71"}} />
          </div>
          <p style={S.progressLabel}>
            <span style={{fontWeight:700,color:pct>=1?"#e84343":"#2ecc71"}}>{regs.length}</span>
            <span style={{opacity:0.45}}> / {MAX} участников</span>
          </p>
          {success ? (
            <div style={S.successBox}>
              <div style={{fontSize:52}}>🎉</div>
              <p style={{fontWeight:800,fontSize:20,margin:"10px 0 4px"}}>Готово!</p>
              <p style={{opacity:0.6,margin:"0 0 4px"}}>Вы записаны на турнир в {dayLabel.toLowerCase()}.</p>
              <p style={{opacity:0.35,fontSize:13,margin:"0 0 20px"}}>Table Tennis Center Varna Mall</p>
              <button style={S.btnPrimary} onClick={()=>{setSuccess(false);setPhoneRaw("");setFirstName("");setLastName("");setIsKnown(false);}}>Записать ещё одного</button>
            </div>
          ) : isFull ? (
            <div style={S.fullBox}>
              <div style={{fontSize:40}}>😔</div>
              <p style={{fontWeight:700,fontSize:18,margin:"10px 0 4px"}}>Мест нет</p>
              <p style={{opacity:0.6,margin:0}}>Все {MAX} мест заняты.</p>
            </div>
          ) : (
            <div>
              <label style={S.label}>Номер телефона</label>
              <input style={S.input} type="tel" placeholder="+7 999 000 00 00"
                value={phoneRaw} onChange={e=>handlePhoneChange(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&canSubmit&&register()} />
              {isKnown && <div style={S.knownBadge}>✓ Добро пожаловать, <strong>{firstName} {lastName}</strong>!</div>}
              {!isKnown && phoneOk && <div style={S.newPlayerNote}>Новый участник — введите имя и фамилию</div>}
              <div style={{...S.fieldRow,opacity:phoneOk?1:0.35,pointerEvents:phoneOk?"auto":"none"}}>
                <div style={S.fieldHalf}>
                  <label style={S.label}>Имя</label>
                  <input style={{...S.input,background:isKnown?"rgba(46,204,113,0.08)":"rgba(255,255,255,0.09)"}}
                    placeholder="Иван" value={firstName} readOnly={isKnown}
                    onChange={e=>setFirstName(e.target.value)}
                    onKeyDown={e=>e.key==="Enter"&&canSubmit&&register()} />
                </div>
                <div style={S.fieldHalf}>
                  <label style={S.label}>Фамилия</label>
                  <input style={{...S.input,background:isKnown?"rgba(46,204,113,0.08)":"rgba(255,255,255,0.09)"}}
                    placeholder="Иванов" value={lastName} readOnly={isKnown}
                    onChange={e=>setLastName(e.target.value)}
                    onKeyDown={e=>e.key==="Enter"&&canSubmit&&register()} />
                </div>
              </div>
              <button style={{...S.btnPrimary,opacity:canSubmit?1:0.4}} onClick={register} disabled={!canSubmit}>
                Записаться на турнир →
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── LEADERBOARD ────────────────────────────────────────────────────────────

  if (view === "leaderboard") {
    return (
      <div style={S.page}>
        <div style={{...S.card,maxWidth:500}}>
          <button style={S.back} onClick={()=>setView("home")}>← Назад</button>
          <div style={{textAlign:"center",marginBottom:24}}>
            <div style={{fontSize:44}}>🏆</div>
            <h2 style={S.h2}>Таблица лидеров</h2>
            <p style={{...S.sub,marginTop:4}}>Table Tennis Center Varna Mall</p>
          </div>
          {leaderboard.length===0 ? (
            <div style={{textAlign:"center",opacity:0.35,padding:"32px 0"}}><div style={{fontSize:36}}>📋</div><p>Результатов пока нет</p></div>
          ) : (
            <div style={{marginBottom:20}}>
              {leaderboard.map((p,i)=>(
                <div key={p.name} style={{...S.lbRow,...(i===0?S.lbGold:i===1?S.lbSilver:i===2?S.lbBronze:{})}}>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <span style={{fontSize:22,width:32,textAlign:"center"}}>{i<3?MEDAL[i]:`#${i+1}`}</span>
                    <div>
                      <div style={{fontWeight:700,fontSize:15}}>{p.name}</div>
                      <div style={{fontSize:11,opacity:0.45,marginTop:2}}>{p.wins[1]}× 🥇 · {p.wins[2]}× 🥈 · {p.wins[3]}× 🥉</div>
                    </div>
                  </div>
                  <div style={{fontWeight:800,fontSize:18,color:"#ffd200"}}>{p.pts} <span style={{fontSize:11,opacity:0.5,fontWeight:400}}>очк.</span></div>
                </div>
              ))}
            </div>
          )}
          <div style={S.divider}/>
          <p style={{fontSize:12,opacity:0.3,textAlign:"center",margin:"10px 0 20px"}}>🥇 = 3 очка · 🥈 = 2 очка · 🥉 = 1 очко</p>
          {history.length>0 && (<>
            <h3 style={{fontSize:14,opacity:0.5,fontWeight:600,margin:"0 0 10px"}}>История турниров</h3>
            {history.map(h=>(
              <div key={h.key} style={S.histRow}>
                <div style={{fontSize:13,opacity:0.45,marginBottom:6}}>{h.day} · {fmtShort(h.date)}</div>
                <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                  {[1,2,3].map(pl=>h.results[pl]&&(<div key={pl} style={{display:"flex",alignItems:"center",gap:4}}><span style={{fontSize:16}}>{MEDAL[pl-1]}</span><span style={{fontSize:13}}>{h.results[pl]}</span></div>))}
                </div>
              </div>
            ))}
          </>)}
        </div>
      </div>
    );
  }

  // ── ADMIN: RESULTS ENTRY ───────────────────────────────────────────────────

  if (view === "admin_results" && resultsKey) {
    const regs = getTournament(resultsKey).registrations || [];
    const tournamentNames = [...new Set(regs.map(r=>(store.players[r.phone]||{}).name||r.name))];
    const otherNames = allPlayerNames.filter(n=>!tournamentNames.includes(n));
    const pickerOptions = [...tournamentNames,...otherNames];
    const existing = getTournament(resultsKey).results;
    function phoneByName(name) { return Object.entries(store.players).find(([,p])=>p.name===name)?.[0]||name; }
    function nameByPhone(phone) { return (store.players[phone]||{}).name||phone; }
    return (
      <div style={S.page}>
        <div style={{...S.card,maxWidth:460}}>
          <button style={S.back} onClick={()=>{setView("admin");setResultsKey(null);}}>← Назад</button>
          <div style={{textAlign:"center",marginBottom:20}}>
            <div style={{fontSize:40}}>🏆</div>
            <h2 style={S.h2}>Результаты турнира</h2>
            <p style={{...S.sub,marginTop:4}}>{dayLabelFromKey(resultsKey)} · {fmtShort(dateFromKey(resultsKey))}</p>
          </div>
          {[1,2,3].map(place=>(
            <div key={place} style={{marginBottom:16}}>
              <label style={S.label}>{MEDAL[place-1]} {place}-е место <span style={{opacity:0.4}}>(+{POINTS[place]} очк.)</span></label>
              <NamePicker
                options={pickerOptions.filter(n=>{const p=phoneByName(n);return !Object.values(resultsDraft).includes(p)||resultsDraft[place]===p;})}
                value={resultsDraft[place]?nameByPhone(resultsDraft[place]):""}
                onChange={name=>setResultsDraft({...resultsDraft,[place]:name?phoneByName(name):""})}
                placeholder="Выбрать участника..."
              />
            </div>
          ))}
          <button style={{...S.btnPrimary,marginTop:8}} onClick={()=>saveResults(resultsKey)}>Сохранить результаты ✓</button>
          {existing&&Object.keys(existing).length>0&&(
            <ConfirmButton label="Удалить результаты" confirmLabel="Точно удалить?" onConfirm={()=>{updateTournament(resultsKey,{results:null});setView("admin");setResultsKey(null);}}
              style={{...S.btnOutline,marginTop:10,width:"100%",padding:"10px",cursor:"pointer",fontSize:13,background:"none",border:"1px solid rgba(232,67,67,0.3)",color:"rgba(232,67,67,0.7)",borderRadius:12}} />
          )}
        </div>
      </div>
    );
  }

  // ── ADMIN ──────────────────────────────────────────────────────────────────

  if (view === "admin") {
    if (!adminUnlocked) {
      return (
        <div style={S.page}>
          <div style={{...S.card,maxWidth:360}}>
            <button style={S.back} onClick={()=>setView("home")}>← Назад</button>
            <div style={{textAlign:"center",marginBottom:20}}>
              <div style={{fontSize:44}}>🔐</div>
              <h2 style={S.h2}>Администратор</h2>
              <p style={{...S.sub,marginTop:4}}>Table Tennis Center Varna Mall</p>
            </div>
            <label style={S.label}>Пароль</label>
            <input style={S.input} type="password" placeholder="••••••••" value={adminKey}
              onChange={e=>setAdminKey(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter")adminKey===ADMIN_PASS?(setAdminUnlocked(true),setAdminError(false)):setAdminError(true);}} />
            {adminError&&<p style={{color:"#e84343",fontSize:13,margin:"0 0 10px"}}>Неверный пароль</p>}
            <button style={S.btnPrimary} onClick={()=>adminKey===ADMIN_PASS?(setAdminUnlocked(true),setAdminError(false)):setAdminError(true)}>Войти</button>
          </div>
        </div>
      );
    }

    const currentKeys = dates.map((d,i)=>tKey(DAY_KEYS[i],d));
    const pastKeys = Object.keys(store.tournaments).filter(k=>!currentKeys.includes(k)).sort((a,b)=>b.localeCompare(a)).slice(0,12);
    const showKeys = adminTab==="registrations"?currentKeys:[...currentKeys,...pastKeys];

    return (
      <div style={S.page}>
        <div style={{...S.card,maxWidth:640}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
            <div>
              <h2 style={{...S.h2,textAlign:"left",margin:0}}>Панель управления</h2>
              <p style={{...S.sub,textAlign:"left",margin:"4px 0 0"}}>Table Tennis Center Varna Mall</p>
            </div>
            <button style={S.btnLogout} onClick={()=>{setView("home");setAdminUnlocked(false);setAdminKey("");}}>Выйти</button>
          </div>

          <div style={S.tabs}>
            <button style={{...S.tab,...(adminTab==="registrations"?S.tabActive:{})}} onClick={()=>setAdminTab("registrations")}>📋 Записи</button>
            <button style={{...S.tab,...(adminTab==="results"?S.tabActive:{})}} onClick={()=>setAdminTab("results")}>🏆 Результаты</button>
            <button style={{...S.tab,...(adminTab==="players"?S.tabActive:{})}} onClick={()=>setAdminTab("players")}>👥 Игроки</button>
          </div>

          {/* PLAYERS TAB */}
          {adminTab==="players" && (
            <div>
              {Object.keys(store.players).length===0
                ? <p style={{opacity:0.35,textAlign:"center",padding:"24px 0"}}>Игроков пока нет</p>
                : Object.entries(store.players).sort((a,b)=>a[1].name.localeCompare(b[1].name)).map(([phone,player])=>(
                  <div key={phone} style={S.playerRow}>
                    {editPhone===phone ? (
                      <div style={{flex:1,display:"flex",gap:8}}>
                        <input style={{...S.input,flex:1,padding:"8px 12px",fontSize:14}} value={editName}
                          onChange={e=>setEditName(e.target.value)}
                          onKeyDown={e=>e.key==="Enter"&&savePlayerName(phone)} autoFocus />
                        <button style={{...S.btnPrimary,width:"auto",padding:"8px 14px",fontSize:13,marginTop:0}} onClick={()=>savePlayerName(phone)}>✓</button>
                        <button style={{background:"none",border:"1px solid rgba(255,255,255,0.2)",color:"rgba(255,255,255,0.5)",borderRadius:10,padding:"8px 12px",cursor:"pointer",fontSize:13}} onClick={()=>setEditPhone(null)}>✕</button>
                      </div>
                    ) : (
                      <>
                        <div style={{flex:1}}>
                          <span style={{fontWeight:600}}>{player.name}</span>
                          <span style={{opacity:0.35,fontSize:12,marginLeft:10}}>{formatPhoneDisplay(phone)}</span>
                        </div>
                        <div style={{display:"flex",gap:6,alignItems:"center"}}>
                          <button style={S.btnEdit} onClick={()=>{setEditPhone(phone);setEditName(player.name);}}>✏️</button>
                          <ConfirmButton label="✕" confirmLabel="Удалить?" onConfirm={()=>deletePlayer(phone)} style={S.btnDel} />
                        </div>
                      </>
                    )}
                  </div>
                ))
              }
            </div>
          )}

          {/* TOURNAMENT TABS */}
          {adminTab!=="players" && showKeys.map(key=>{
            const dayLabel = dayLabelFromKey(key);
            const regs = getTournament(key).registrations||[];
            const results = getTournament(key).results;
            const isPast = !currentKeys.includes(key);
            return (
              <div key={key} style={{...S.adminBlock,opacity:isPast?0.75:1}}>
                <div style={S.adminBlockHeader}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    <span style={{fontWeight:700,fontSize:15}}>{dayLabel}</span>
                    <span style={{opacity:0.45,fontSize:13}}>{fmtShort(dateFromKey(key))}</span>
                    {results&&<span style={{fontSize:12,background:"rgba(46,204,113,0.15)",color:"#2ecc71",borderRadius:20,padding:"2px 8px"}}>результаты ✓</span>}
                  </div>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <span style={{...S.countBadge,background:regs.length>=MAX?"rgba(232,67,67,0.2)":"rgba(46,204,113,0.15)",color:regs.length>=MAX?"#e84343":"#2ecc71"}}>{regs.length}/{MAX}</span>
                    <button style={S.btnResults} onClick={()=>{setResultsKey(key);setResultsDraft(results||{1:"",2:"",3:""});setView("admin_results");}}>
                      {results?"✏️ Изменить":"🏆 Итоги"}
                    </button>
                  </div>
                </div>
                {results&&(
                  <div style={S.resultsPreview}>
                    {[1,2,3].map(pl=>results[pl]&&(<span key={pl} style={S.resultChip}>{MEDAL[pl-1]} {(store.players[results[pl]]||{}).name||results[pl]}</span>))}
                  </div>
                )}
                {adminTab==="registrations"&&(
                  regs.length===0
                    ? <p style={{opacity:0.3,fontSize:13,margin:"8px 0 0"}}>Записей нет</p>
                    : <div style={{marginTop:8}}>
                        {regs.map((r,idx)=>{
                          const name=(store.players[r.phone]||{}).name||r.name;
                          return (
                            <div key={idx} style={S.adminRow}>
                              <div style={{display:"flex",alignItems:"center",gap:10}}>
                                <span style={S.numBadge}>{idx+1}</span>
                                <div>
                                  <span style={{fontWeight:600}}>{name}</span>
                                  <span style={{opacity:0.3,fontSize:11,marginLeft:8}}>{formatPhoneDisplay(r.phone)}</span>
                                </div>
                              </div>
                              <ConfirmButton label="✕" confirmLabel="Удалить?" onConfirm={()=>removeReg(key,idx)} style={S.btnDel} />
                            </div>
                          );
                        })}
                      </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── HOME ───────────────────────────────────────────────────────────────────

  const top3 = leaderboard.slice(0,3);
  return (
    <div style={S.page}>
      <div style={{...S.card,maxWidth:460}}>
        <div style={S.homeHeader}>
          <div style={S.logoWrap}><span style={{fontSize:36}}>🏓</span></div>
          <h1 style={S.h1}>Table Tennis Center</h1>
          <p style={S.clubSub}>Varna Mall</p>
          <p style={S.heroNote}>Запись на турниры · Пн, Ср, Пт · до {MAX} участников</p>
        </div>

        <div style={S.dayList}>
          {dates.map((date,i)=>{
            const dk=DAY_KEYS[i];
            const regs=getRegs(dk,date);
            const full=regs.length>=MAX;
            const pct=regs.length/MAX;
            return (
              <button key={dk} style={{...S.dayCard,...(full?S.dayCardFull:{})}}
                onClick={()=>{if(!full){setSelDay(dk);setSelDate(date);setView("register");setSuccess(false);setPhoneRaw("");setFirstName("");setLastName("");setIsKnown(false);}}}>
                <div>
                  <div style={S.dayName}>{DAYS[i]}</div>
                  <div style={S.dayDate}>{fmt(date)}</div>
                  <div style={S.miniBarWrap}>
                    <div style={{height:"100%",width:`${pct*100}%`,borderRadius:3,background:pct>=1?"#e84343":pct>0.7?"#f7971e":"#2ecc71",transition:"width 0.4s"}} />
                  </div>
                </div>
                <div style={S.dayRight}>
                  {full?<span style={{color:"#e84343",fontWeight:700,fontSize:14}}>Мест нет</span>
                       :<span style={{color:"#2ecc71",fontWeight:700,fontSize:15}}>{MAX-regs.length} <span style={{opacity:0.55,fontWeight:400,fontSize:13}}>своб.</span></span>}
                  <span style={{opacity:0.35,fontSize:12,marginTop:4}}>{regs.length}/{MAX}</span>
                  {!full&&<span style={{fontSize:18,marginTop:8,opacity:0.5}}>→</span>}
                </div>
              </button>
            );
          })}
        </div>

        {/* cancel link */}
        <button style={S.btnCancel} onClick={()=>setView("cancel")}>
          📵 Отменить свою запись
        </button>

        {top3.length>0 ? (
          <div style={S.miniLeader}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <span style={{fontWeight:700,fontSize:14}}>🏆 Лидеры</span>
              <button style={S.btnSeeAll} onClick={()=>setView("leaderboard")}>Все результаты →</button>
            </div>
            {top3.map((p,i)=>(
              <div key={p.name} style={S.miniLeaderRow}>
                <span style={{fontSize:18}}>{MEDAL[i]}</span>
                <span style={{fontWeight:600,flex:1,marginLeft:10}}>{p.name}</span>
                <span style={{fontWeight:700,color:"#ffd200"}}>{p.pts}</span>
                <span style={{opacity:0.4,fontSize:12,marginLeft:4}}>очк.</span>
              </div>
            ))}
          </div>
        ) : (
          <button style={S.btnLeaderboard} onClick={()=>setView("leaderboard")}>🏆 Таблица лидеров</button>
        )}

        <button style={S.btnAdmin} onClick={()=>{setView("admin");setAdminUnlocked(false);setAdminKey("");}}>
          🔐 Панель администратора
        </button>
      </div>
    </div>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────

const S = {
  page:{minHeight:"100vh",background:"linear-gradient(160deg,#0d0d1a 0%,#1a1040 50%,#0d1a2e 100%)",display:"flex",alignItems:"center",justifyContent:"center",padding:"24px 16px",fontFamily:"'Segoe UI',system-ui,sans-serif"},
  card:{width:"100%",background:"rgba(255,255,255,0.055)",backdropFilter:"blur(24px)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:28,padding:"32px 28px",color:"#fff",boxShadow:"0 24px 64px rgba(0,0,0,0.5)"},
  back:{background:"none",border:"none",color:"rgba(255,255,255,0.4)",cursor:"pointer",fontSize:14,padding:0,marginBottom:24,display:"block"},
  homeHeader:{textAlign:"center",marginBottom:24},
  logoWrap:{width:72,height:72,borderRadius:"50%",background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"},
  h1:{margin:"0 0 4px",fontSize:24,fontWeight:800,letterSpacing:"-0.5px"},
  clubSub:{margin:"0 0 8px",fontSize:15,opacity:0.5,letterSpacing:"0.5px"},
  heroNote:{margin:0,fontSize:13,opacity:0.35},
  h2:{margin:"0 0 2px",fontSize:20,fontWeight:700,textAlign:"center"},
  sub:{margin:0,opacity:0.5,fontSize:13,textAlign:"center"},
  dayList:{display:"flex",flexDirection:"column",gap:10,marginBottom:10},
  dayCard:{display:"flex",justifyContent:"space-between",alignItems:"center",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:18,padding:"16px 18px",cursor:"pointer",color:"#fff",textAlign:"left",width:"100%"},
  dayCardFull:{opacity:0.4,cursor:"default"},
  dayName:{fontWeight:700,fontSize:17,marginBottom:2},
  dayDate:{fontSize:13,opacity:0.5},
  miniBarWrap:{width:110,height:6,borderRadius:3,background:"rgba(255,255,255,0.1)",marginTop:8},
  dayRight:{display:"flex",flexDirection:"column",alignItems:"flex-end"},
  btnCancel:{width:"100%",marginBottom:10,background:"none",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.35)",borderRadius:12,padding:"9px",cursor:"pointer",fontSize:13},
  miniLeader:{background:"rgba(255,215,0,0.06)",border:"1px solid rgba(255,215,0,0.15)",borderRadius:16,padding:"14px 16px",marginBottom:10},
  miniLeaderRow:{display:"flex",alignItems:"center",padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,0.05)"},
  btnSeeAll:{background:"none",border:"none",color:"rgba(255,215,0,0.6)",cursor:"pointer",fontSize:13},
  btnLeaderboard:{width:"100%",marginBottom:10,background:"rgba(255,215,0,0.08)",border:"1px solid rgba(255,215,0,0.2)",color:"rgba(255,215,0,0.8)",borderRadius:12,padding:"11px",cursor:"pointer",fontSize:14,fontWeight:600},
  btnAdmin:{width:"100%",background:"none",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.3)",borderRadius:12,padding:"10px",cursor:"pointer",fontSize:13},
  regHeader:{display:"flex",alignItems:"center",gap:14,marginBottom:20},
  progressWrap:{height:10,borderRadius:6,background:"rgba(255,255,255,0.1)",overflow:"hidden",marginBottom:6},
  progressBar:{height:"100%",borderRadius:6,transition:"width 0.4s"},
  progressLabel:{fontSize:14,margin:"0 0 16px",textAlign:"right"},
  knownBadge:{background:"rgba(46,204,113,0.12)",border:"1px solid rgba(46,204,113,0.25)",borderRadius:10,padding:"8px 12px",fontSize:14,color:"#2ecc71",marginBottom:12},
  newPlayerNote:{background:"rgba(255,215,0,0.07)",border:"1px solid rgba(255,215,0,0.2)",borderRadius:10,padding:"8px 12px",fontSize:13,color:"rgba(255,215,0,0.8)",marginBottom:12},
  fieldRow:{display:"flex",gap:12,marginBottom:14},
  fieldHalf:{flex:1},
  label:{fontSize:13,opacity:0.55,marginBottom:6,display:"block"},
  input:{background:"rgba(255,255,255,0.09)",border:"1px solid rgba(255,255,255,0.18)",borderRadius:12,padding:"12px 14px",color:"#fff",fontSize:15,outline:"none",width:"100%",boxSizing:"border-box"},
  btnPrimary:{width:"100%",marginTop:4,background:"linear-gradient(135deg,#f7971e 0%,#ffd200 100%)",color:"#1a1a2e",border:"none",borderRadius:14,padding:"14px 24px",fontWeight:800,fontSize:16,cursor:"pointer"},
  btnOutline:{background:"none",border:"1px solid rgba(232,67,67,0.3)",color:"rgba(232,67,67,0.7)",borderRadius:12,padding:"10px",cursor:"pointer",fontSize:13},
  successBox:{textAlign:"center",padding:"16px 0 8px"},
  fullBox:{textAlign:"center",padding:"28px 20px",background:"rgba(232,67,67,0.08)",borderRadius:16,border:"1px solid rgba(232,67,67,0.2)"},
  lbRow:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 12px",borderRadius:12,marginBottom:6,background:"rgba(255,255,255,0.04)"},
  lbGold:{background:"rgba(255,215,0,0.1)",border:"1px solid rgba(255,215,0,0.2)"},
  lbSilver:{background:"rgba(192,192,192,0.08)",border:"1px solid rgba(192,192,192,0.15)"},
  lbBronze:{background:"rgba(205,127,50,0.08)",border:"1px solid rgba(205,127,50,0.15)"},
  divider:{height:1,background:"rgba(255,255,255,0.08)",margin:"8px 0"},
  histRow:{padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,0.06)"},
  btnLogout:{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",color:"rgba(255,255,255,0.6)",borderRadius:10,padding:"8px 14px",cursor:"pointer",fontSize:13},
  tabs:{display:"flex",gap:6,marginBottom:20,background:"rgba(255,255,255,0.05)",borderRadius:12,padding:4},
  tab:{flex:1,background:"none",border:"none",color:"rgba(255,255,255,0.45)",borderRadius:10,padding:"8px",cursor:"pointer",fontSize:13,fontWeight:600},
  tabActive:{background:"rgba(255,255,255,0.12)",color:"#fff"},
  adminBlock:{background:"rgba(255,255,255,0.045)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:16,padding:"14px 16px",marginBottom:12},
  adminBlockHeader:{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8},
  countBadge:{borderRadius:20,padding:"3px 10px",fontSize:12,fontWeight:700},
  btnResults:{background:"rgba(255,215,0,0.1)",border:"1px solid rgba(255,215,0,0.2)",color:"rgba(255,215,0,0.9)",borderRadius:10,padding:"5px 10px",cursor:"pointer",fontSize:12,fontWeight:600},
  resultsPreview:{display:"flex",gap:8,flexWrap:"wrap",marginTop:10},
  resultChip:{background:"rgba(255,255,255,0.07)",borderRadius:20,padding:"3px 10px",fontSize:13},
  adminRow:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.06)"},
  numBadge:{width:24,height:24,borderRadius:"50%",background:"rgba(255,255,255,0.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,flexShrink:0},
  btnDel:{background:"none",border:"none",color:"rgba(232,67,67,0.65)",cursor:"pointer",fontSize:15,padding:"0 4px"},
  btnEdit:{background:"none",border:"none",color:"rgba(255,255,255,0.4)",cursor:"pointer",fontSize:15,padding:"0 4px"},
  playerRow:{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:"rgba(255,255,255,0.04)",borderRadius:12,marginBottom:8},
  cancelCard:{display:"flex",justifyContent:"space-between",alignItems:"center",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:14,padding:"14px 16px",marginBottom:10},
  btnCancelReg:{background:"rgba(232,67,67,0.1)",border:"1px solid rgba(232,67,67,0.3)",color:"rgba(232,67,67,0.8)",borderRadius:10,padding:"8px 14px",cursor:"pointer",fontSize:13,fontWeight:600},
};
