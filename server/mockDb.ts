import { randomUUID } from "node:crypto";
import { hashPassword } from "./crypto.js";

interface MockOrg { id:string; slug:string; name:string; timezone:string; points_per_litre:number; reward_threshold_points:number; reward_name:string; reward_quantity_ml:number; created_at:string; }
interface MockUser { id:string; organization_id:string; code:string; name:string; role:"OWNER"|"MANAGER"|"EMPLOYEE"; active:boolean; created_at:string; }
interface MockCredential { user_id:string; password_hash:string; encrypted_password:string|null; updated_at:string; }
interface MockSession { token_hash:string; user_id:string; expires_at:Date; created_at:string; }
interface MockPump { id:string; organization_id:string; name:string; active:boolean; created_at:string; updated_at:string; }
interface MockFuel { id:string; organization_id:string; name:string; price_paise:number; }
interface MockTransaction { id:string; organization_id:string; pump_id:string; employee_id:string; fuel_id:string; plate:string; quantity_ml:number; price_paise:number; amount_paise:number; payment_method:string; points:number; fraud:boolean; business_day:string; idempotency_key:string; request_hash:string; created_at:string; }
interface MockPointEntry { id:string; organization_id:string; plate:string; transaction_id:string; points:number; created_at:string; }
interface MockCoupon { id:string; organization_id:string; code:string; plate:string; expires_at:string; created_by:string; redeemed_by:string|null; redeemed_at:string|null; created_at:string; }
interface MockAuditLog { id:number; organization_id:string; actor_id:string; action:string; target_id:string|null; created_at:string; }
interface MockCustomer { id:string; organization_id:string; name:string; phone_e164:string; active:boolean; created_at:string; }
interface MockCustomerVehicle { id:string; organization_id:string; customer_id:string; plate:string; label?:string; active:boolean; created_at:string; }
interface MockCustomerSession { token_hash:string; organization_id:string; customer_id:string; trusted_until:string; last_used_at:string; created_at:string; }
interface MockRewardEntitlement { id:string; organization_id:string; plate:string; code:string; reward_name:string; points_cost:number; quantity_ml:number; }

class MockDatabase {
  private initialized=false;
  org:MockOrg={id:"00000000-0000-4000-8000-000000000001",slug:"fuelpulse-main",name:"FuelPulse Demo Station",timezone:"Asia/Kolkata",points_per_litre:1,reward_threshold_points:100,reward_name:"Free Fuel",reward_quantity_ml:1000,created_at:new Date().toISOString()};
  users:MockUser[]=[
    {id:"00000000-0000-4000-8000-000000000011",organization_id:this.org.id,code:"FP-OWNER",name:"FuelPulse Owner",role:"OWNER",active:true,created_at:new Date().toISOString()},
    {id:"00000000-0000-4000-8000-000000000012",organization_id:this.org.id,code:"FP-MANAGER",name:"FuelPulse Manager",role:"MANAGER",active:true,created_at:new Date().toISOString()},
    {id:"00000000-0000-4000-8000-000000000013",organization_id:this.org.id,code:"FP-EMPLOYEE",name:"FuelPulse Employee",role:"EMPLOYEE",active:true,created_at:new Date().toISOString()},
  ];
  credentials:MockCredential[]=[];sessions:MockSession[]=[];
  pumps:MockPump[]=[{id:"00000000-0000-4000-8000-000000000021",organization_id:this.org.id,name:"Pump 1",active:true,created_at:new Date().toISOString(),updated_at:new Date().toISOString()},{id:"00000000-0000-4000-8000-000000000022",organization_id:this.org.id,name:"Pump 2",active:true,created_at:new Date().toISOString(),updated_at:new Date().toISOString()}];
  fuels:MockFuel[]=[{id:"00000000-0000-4000-8000-000000000031",organization_id:this.org.id,name:"Petrol",price_paise:10000},{id:"00000000-0000-4000-8000-000000000032",organization_id:this.org.id,name:"Diesel",price_paise:9200}];
  pumpFuels={pump_id:this.pumps[0].id,fuel_id:this.fuels[0].id}?[{pump_id:this.pumps[0].id,fuel_id:this.fuels[0].id},{pump_id:this.pumps[0].id,fuel_id:this.fuels[1].id},{pump_id:this.pumps[1].id,fuel_id:this.fuels[0].id},{pump_id:this.pumps[1].id,fuel_id:this.fuels[1].id}]:[];
  transactions:MockTransaction[]=[
    {id:"00000000-0000-4000-8000-000000000101",organization_id:this.org.id,pump_id:this.pumps[0].id,employee_id:this.users[2].id,fuel_id:this.fuels[0].id,plate:"MH12AB1234",quantity_ml:10000,price_paise:10000,amount_paise:100000,payment_method:"UPI",points:10,fraud:false,business_day:new Date().toISOString().split("T")[0],idempotency_key:"00000000-0000-4000-8000-000000000201",request_hash:"hash1",created_at:new Date(Date.now()-3600000).toISOString()},
    {id:"00000000-0000-4000-8000-000000000102",organization_id:this.org.id,pump_id:this.pumps[1].id,employee_id:this.users[2].id,fuel_id:this.fuels[1].id,plate:"DL01CD5678",quantity_ml:20000,price_paise:9200,amount_paise:184000,payment_method:"CASH",points:20,fraud:false,business_day:new Date().toISOString().split("T")[0],idempotency_key:"00000000-0000-4000-8000-000000000202",request_hash:"hash2",created_at:new Date(Date.now()-7200000).toISOString()},
  ];
  pointsLedger:MockPointEntry[]=[{id:"00000000-0000-4000-8000-000000000301",organization_id:this.org.id,plate:"MH12AB1234",transaction_id:this.transactions[0].id,points:10,created_at:new Date().toISOString()}];
  coupons:MockCoupon[]=[];auditLogs:MockAuditLog[]=[];
  customers:MockCustomer[]=[{id:"00000000-0000-4000-8000-000000000401",organization_id:this.org.id,name:"Aditi Rao",phone_e164:"+919876543210",active:true,created_at:new Date().toISOString()}];
  customerVehicles:MockCustomerVehicle[]=[{id:"00000000-0000-4000-8000-000000000501",organization_id:this.org.id,customer_id:this.customers[0].id,plate:"MH12AB1234",label:"Honda City",active:true,created_at:new Date().toISOString()}];
  customerSessions:MockCustomerSession[]=[];rewardEntitlements:MockRewardEntitlement[]=[];

  async init(){if(this.initialized)return;try{const defaultHash=await hashPassword("password12345");for(const u of this.users)this.credentials.push({user_id:u.id,password_hash:defaultHash,encrypted_password:null,updated_at:new Date().toISOString()});this.initialized=true;}catch{this.initialized=true;}}

  async executeQuery(sqlText:string,params:unknown[]=[]):Promise<{rows:object[];rowCount:number}>{await this.init();const sql=sqlText.trim().replace(/\s+/g," ");
    if(/^select 1\b/i.test(sql))return{rows:[{"?column?":1}],rowCount:1};
    if(/^(BEGIN|COMMIT|ROLLBACK|SET LOCAL|select set_config)/i.test(sql))return{rows:[],rowCount:0};
    if(/select pg_advisory_xact_lock/i.test(sql))return{rows:[{pg_advisory_xact_lock:true}],rowCount:1};
    if(/insert into app\.login_limits/i.test(sql))return{rows:[{attempts:1}],rowCount:1};
    if(/delete from app\.login_limits/i.test(sql))return{rows:[],rowCount:1};
    if(/insert into app\.login_events/i.test(sql))return{rows:[],rowCount:1};
    if(/from app\.users u join app\.organizations o.*where o\.slug=\$1 and u\.code=\$2/i.test(sql)){const slug=String(params[0]??"").toLowerCase(),code=String(params[1]??"").toUpperCase();const user=this.users.find(u=>u.code.toUpperCase()===code&&(this.org.slug.toLowerCase()===slug||slug==="demo"||slug==="station-01"||slug==="fuelpulse-main"||!slug));if(!user)return{rows:[],rowCount:0};const cred=this.credentials.find(c=>c.user_id===user.id);return{rows:[{...user,password_hash:cred?.password_hash??""}],rowCount:1};}
    if(/from app\.sessions s join app\.users u.*where s\.token_hash=\$1/i.test(sql)){const s=this.sessions.find(x=>x.token_hash===String(params[0]));if(!s||s.expires_at<=new Date())return{rows:[],rowCount:0};const u=this.users.find(x=>x.id===s.user_id&&x.active);return u?{rows:[{id:u.id,organization_id:u.organization_id,name:u.name,code:u.code,role:u.role}],rowCount:1}:{rows:[],rowCount:0};}
    if(/delete from app\.sessions where token_hash=\$1/i.test(sql)){this.sessions=this.sessions.filter(s=>s.token_hash!==String(params[0]));return{rows:[],rowCount:1};}
    if(/select \* from app\.organizations\b/i.test(sql)||/from app\.organizations where slug=\$1/i.test(sql))return{rows:[{...this.org}],rowCount:1};
    if(/select \(now\(\) at time zone timezone\)::date d,points_per_litre/i.test(sql))return{rows:[{d:new Date().toISOString().split("T")[0],points_per_litre:this.org.points_per_litre}],rowCount:1};
    if(/update app\.organizations set points_per_litre=\$1 where id=\$2/i.test(sql)){this.org.points_per_litre=Number(params[0]);return{rows:[],rowCount:1};}
    if(/select \* from app\.pumps order by name/i.test(sql))return{rows:[...this.pumps].sort((a,b)=>a.name.localeCompare(b.name)),rowCount:this.pumps.length};
    if(/select \* from app\.fuels order by name/i.test(sql))return{rows:[...this.fuels].sort((a,b)=>a.name.localeCompare(b.name)),rowCount:this.fuels.length};
    if(/select pump_id,fuel_id from app\.pump_fuels/i.test(sql))return{rows:[...this.pumpFuels],rowCount:this.pumpFuels.length};
    if(/select f\.price_paise from app\.fuels f join app\.pump_fuels pf.*where f\.id=\$2/i.test(sql)){const fuel=this.fuels.find(f=>f.id===String(params[1]));return{rows:fuel?[{price_paise:fuel.price_paise}]:[],rowCount:fuel?1:0};}
    return{rows:[],rowCount:0};
  }
}
export const mockDb=new MockDatabase();
