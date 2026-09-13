import { useEffect, useState } from 'react';
import { api, errorText } from './api';
import { ShieldCheck, LogOut, Plus, RefreshCw, Copy, CheckCircle2 } from 'lucide-react';

interface Org { id:string; slug:string; name:string; created_at:string; active_users:number|string; }
interface Created { station_slug:string; owner_code:string; ownerPassword:string; name:string; }

export function PrivateAdmin(){
  const [authenticated,setAuthenticated]=useState(false);
  const [ready,setReady]=useState(false);
  const [password,setPassword]=useState('');
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  const [orgs,setOrgs]=useState<Org[]>([]);
  const [created,setCreated]=useState<Created|null>(null);

  async function load(){ setOrgs(await api<Org[]>('/admin/organizations')); }
  useEffect(()=>{ api('/admin/me').then(()=>{setAuthenticated(true);return load();}).catch(()=>{}).finally(()=>setReady(true)); },[]);

  async function login(e:React.FormEvent){ e.preventDefault();setBusy(true);setNotice('');try{await api('/admin/login',{password});setPassword('');setAuthenticated(true);await load();}catch(e){setNotice(errorText(e));}finally{setBusy(false);} }
  async function logout(){await api('/admin/logout',{});setAuthenticated(false);setOrgs([]);setCreated(null);}
  async function createOwner(e:React.FormEvent){e.preventDefault();setBusy(true);setNotice('');setCreated(null);try{const d=await api<Created>('/admin/owners',{organizationName:(e.currentTarget as HTMLFormElement).organizationName.value,stationId:(e.currentTarget as HTMLFormElement).stationId.value,ownerName:(e.currentTarget as HTMLFormElement).ownerName.value});setCreated(d);await load();(e.currentTarget as HTMLFormElement).reset();}catch(e){setNotice(errorText(e));}finally{setBusy(false);}}
  async function copy(v:string){await navigator.clipboard.writeText(v);setNotice('Copied to clipboard');}

  if(!ready)return <div className="admin-shell"><div className="admin-card">Loading private admin…</div></div>;
  if(!authenticated)return <div className="admin-shell"><div className="admin-card admin-login"><div className="admin-mark"><ShieldCheck/></div><p className="eyebrow">PRIVATE CONTROL PLANE</p><h1>FuelPulse Admin</h1><p>Restricted administration for provisioning customer owners and organizations.</p>{notice&&<div className="login-error" role="alert">{notice}</div>}<form onSubmit={login}><label>Admin password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={16} autoComplete="current-password" required disabled={busy}/></label><button className="primary" disabled={busy}>{busy?'Authenticating…':'Enter Admin'}</button></form></div></div>;

return <div className="admin-shell"><header className="admin-header"><div><div className="brand"><b>F</b>FuelPulse</div><span>Private Admin</span></div><button className="ghost" onClick={()=>logout().catch(e=>setNotice(errorText(e)))}><LogOut/> Sign out</button></header><main className="admin-main"><div className="admin-title"><div><p className="eyebrow">CONTROL PLANE</p><h1>Customer provisioning</h1><p>Create isolated FuelPulse organizations and issue owner credentials.</p></div><button className="ghost" onClick={()=>load().catch(e=>setNotice(errorText(e)))}><RefreshCw/> Refresh</button></div>{notice&&<div className="notice">{notice}</div>}<section className="admin-grid"><form className="admin-card" onSubmit={createOwner}><div className="admin-card-title"><span><Plus/> New owner</span></div><label>Business / organization name<input name="organizationName" placeholder="Example Fuel Station" required maxLength={120}/></label><label>Station ID<input name="stationId" placeholder="example-fuel" pattern="[a-z0-9][a-z0-9-]{2,62}" required/><small>Lowercase letters, numbers and hyphens.</small></label><label>Owner name<input name="ownerName" placeholder="Owner name" required maxLength={120}/></label><button className="primary" disabled={busy}>{busy?'Creating…':'Generate owner credentials'}</button></form>{created&&<section className="admin-card credential-card"><div className="admin-card-title"><span><CheckCircle2/> Owner created</span></div><p>Save these credentials now. The generated password is not stored as plaintext and will not be shown again.</p><div className="credential"><small>Station ID</small><strong>{created.station_slug}</strong><button onClick={()=>copy(created.station_slug)}><Copy/></button></div><div className="credential"><small>Owner code</small><strong>{created.owner_code}</strong><button onClick={()=>copy(created.owner_code)}><Copy/></button></div><div className="credential"><small>Temporary password</small><strong>{created.ownerPassword}</strong><button onClick={()=>copy(created.ownerPassword)}><Copy/></button></div></section>}</section><section className="admin-card"><div className="admin-card-title"><span>Organizations</span><strong>{orgs.length}</strong></div>{orgs.length?<div className="admin-table"><table><thead><tr><th>Organization</th><th>Station ID</th><th>Active users</th><th>Created</th></tr></thead><tbody>{orgs.map(o=><tr key={o.id}><td>{o.name}</td><td><code>{o.slug}</code></td><td>{o.active_users}</td><td>{new Date(o.created_at).toLocaleDateString('en-IN')}</td></tr>)}</tbody></table></div>:<p className="muted">No customer organizations yet.</p>}</section></main></div>;
}
