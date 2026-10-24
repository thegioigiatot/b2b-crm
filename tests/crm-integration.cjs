/* eslint-disable @typescript-eslint/no-require-imports -- CJS hook adapts Next request APIs for integration tests. */
/* Integration: real PostgreSQL and real actions/DAL; only request cookies/cache/redirect are adapted outside Next. */
const assert = require('node:assert/strict');
const Module = require('node:module');
let currentUser;
const load = Module._load;
Module._load = function(name, ...args) {
  if (name === 'server-only') return {};
  if (name === 'next/headers') return { cookies: async () => ({ get: key => key === 'dev_uid' && currentUser ? { value: currentUser } : undefined }) };
  if (name === 'next/cache') return { revalidatePath() {} };
  if (name === 'next/navigation') return { redirect: path => { throw new Error(`NEXT_REDIRECT:${path}`); } };
  return load.call(this, name, ...args);
};
const { prisma: db } = require('../lib/prisma.ts');
const actions = require('../lib/actions.ts');
const contacts = require('../lib/deal-actions.ts');
const q = require('../lib/queries.ts');
const billing = require('../lib/billing.ts');
const { resolvePerms } = require('../lib/permissions.ts');
const tag = `TEST-${Date.now()}`;
const checks = [];
const form = obj => { const f = new FormData(); for(const [k,v] of Object.entries(obj)) if(v!=null) f.set(k,String(v)); return f; };
async function check(name, fn) { await fn(); checks.push({name,pass:true}); console.log(`PASS ${name}`); }
async function deny(fn) { await assert.rejects(fn, e => !e.message.startsWith('NEXT_REDIRECT:')); }
let ea,eb,ua,ub,ca,cb,stage,product,da,dbb,contact;
async function main() {
  if (!process.env.DATABASE_URL?.includes('_test')) throw Error('Use a separate *_test database only.');
  ea=await db.employee.create({data:{code:tag+'A',name:'TEST SALES A'}}); eb=await db.employee.create({data:{code:tag+'B',name:'TEST SALES B'}});
  ua=await db.user.create({data:{email:tag+'a@example.invalid',role:'SALES',active:true,employeeId:ea.id,extraPerms:JSON.stringify({deleteRecords:true})}});
  ub=await db.user.create({data:{email:tag+'b@example.invalid',role:'SALES',active:true,employeeId:eb.id}});
  const ctxA={user:ua,employee:ea,perms:resolvePerms('SALES',null,ua.extraPerms)}, ctxB={user:ub,employee:eb,perms:resolvePerms('SALES',null,null)};
  ca=await db.customer.create({data:{code:tag+'CA',name:tag+'customer A',employeeId:ea.id}}); cb=await db.customer.create({data:{code:tag+'CB',name:tag+'customer B',employeeId:eb.id}});
  stage=await db.pipelineStage.create({data:{name:tag+'won',isWon:true}}); product=await db.productGroup.create({data:{name:tag+'SEO'}});
  da=await db.deal.create({data:{code:tag+'DA',title:'Test recurring SEO',customerId:ca.id,ownerId:ea.id,status:'Thắng',stageId:stage.id}});
  dbb=await db.deal.create({data:{code:tag+'DB',title:'Test B',customerId:cb.id,ownerId:eb.id,status:'Thắng',stageId:stage.id}});
  contact=await db.contact.create({data:{name:tag+' B',customerId:cb.id}});
  currentUser=ua.id;
  await check('SALES A cannot list B even with forged employee filter',async()=>assert.equal((await q.getCustomers({employeeId:eb.id})).length,0));
  await check('SALES A cannot read B detail or Contact list',async()=>{assert.equal(await q.getCustomerDetail(cb.id),null);await deny(()=>q.getContacts(cb.id));});
  await check('SALES A cannot edit/reassign B customer',async()=>{await deny(()=>actions.upsertCustomer(form({id:cb.id,code:cb.code,name:'hacked',employeeId:ea.id})));await deny(()=>actions.upsertCustomer(form({id:ca.id,code:ca.code,name:ca.name,employeeId:eb.id})));});
  await check('SALES A cannot create/update/delete B Contact',async()=>{await deny(()=>contacts.createContact(form({customerId:cb.id,name:'hacked'})));await deny(()=>contacts.updateContact(contact.id,form({name:'hacked',customerId:ca.id})));await deny(()=>contacts.deleteContact(contact.id,ca.id));});
  await check('Foreign Contact cannot be attached to own deal',async()=>await deny(()=>contacts.setDealContact(da.id,contact.id)));
  await check('Care log and task reject foreign customer/deal references',async()=>{await deny(()=>actions.addCareLog(form({customerId:cb.id,content:'hacked'})));await deny(()=>actions.createTask(form({title:'hacked',customerId:cb.id})));});
  let oid;
  await check('One-off payment links deal and repeat submission creates one order',async()=>{const f=form({date:'2026-10-24',customerId:ca.id,employeeId:ea.id,dealId:da.id,isClosed:'on',value:1000000,bookingKey:tag+'oneoff'});await actions.createOrder(f);await actions.createOrder(f);const rows=await db.order.findMany({where:{dealId:da.id}});assert.equal(rows.length,1);oid=rows[0].id;});
  currentUser=ub.id;
  await check('SALES B cannot see A sales or forged sales filter',async()=>{assert.equal((await q.getOrders({employeeId:ea.id})).length,0);await deny(()=>actions.deleteOrder(oid));await deny(()=>actions.createOrder(form({date:'2026-10-24',dealId:da.id,customerId:ca.id,employeeId:eb.id,isClosed:'on',value:1,bookingKey:tag+'hack'})));});
  await check('Dashboard and KPI remain in SALES B scope',async()=>{const d=await q.getDashboardData('2026-10');assert.equal(d.totals.revenue,0);assert.ok((await q.getKpiTable('2026-10')).employees.every(e=>e.id===eb.id));});
  currentUser=ua.id;
  await actions.deleteOrder(oid);
  let cid,pid;
  await check('Foreign SALES cannot open contract',async()=>await deny(()=>billing.openContract(ctxB,{dealId:da.id,title:'SEO',startsOn:'2026-01-31',endsOn:'2026-03-31',cadenceMonths:1,agencyFee:10000000,mediaBudget:20000000,vatRate:10,productGroupId:product.id})));
  const input={dealId:da.id,title:'SEO',startsOn:'2026-01-31',endsOn:'2026-03-31',cadenceMonths:1,agencyFee:10000000,mediaBudget:20000000,vatRate:10,productGroupId:product.id};
  await check('Concurrent contract creation is idempotent',async()=>{const ids=await Promise.all([billing.openContract(ctxA,input),billing.openContract(ctxA,input)]);assert.equal(ids[0],ids[1]);cid=ids[0];});
  await check('Concurrent period creation is idempotent and VAT exact',async()=>{const ids=await Promise.all([billing.issuePeriod(ctxA,cid,'2026-02-10',0),billing.issuePeriod(ctxA,cid,'2026-02-10',0)]);assert.equal(ids[0],ids[1]);pid=ids[0];assert.equal(Number((await db.billingPeriod.findUnique({where:{id:pid}})).vatAmount),1000000);});
  const pay={periodId:pid,receiptKey:tag+'receipt1',reference:tag+'bank1',paidOn:'2026-10-24',agencyAmount:4000000,mediaAmount:10000000,vatAmount:400000};
  await check('Concurrent payment retry creates one receipt and one ledger order',async()=>{const ids=await Promise.all([billing.collectPayment(ctxA,pay),billing.collectPayment(ctxA,pay)]);assert.equal(ids[0],ids[1]);assert.equal(await db.order.count({where:{paymentId:ids[0]}}),1);});
  await check('Duplicate bank reference / changed idempotency payload / overpayment rejected',async()=>{await deny(()=>billing.collectPayment(ctxA,{...pay,receiptKey:tag+'dup'}));await deny(()=>billing.collectPayment(ctxA,{...pay,agencyAmount:1}));await deny(()=>billing.collectPayment(ctxA,{...pay,receiptKey:tag+'over',reference:'over',agencyAmount:7000000}));});
  await check('Two installments settle agency/media/VAT separately',async()=>{await billing.collectPayment(ctxA,{...pay,receiptKey:tag+'receipt2',reference:tag+'bank2',agencyAmount:6000000,mediaAmount:10000000,vatAmount:600000});const periods=await billing.billingForDeal(ctxA,da.id);assert.equal(periods.periods[0].payments.length,2);const orders=await db.order.findMany({where:{dealId:da.id}});assert.equal(orders.reduce((s,o)=>s+o.value,0),10000000);assert.equal((await q.getDashboardData('2026-10')).totals.revenue,10000000);});
  await check('KPI includes collected fees before any target and stays single after setting a target',async()=>{
    let k = await q.getKpiTable('2026-10');
    assert.equal(k.rows.reduce((s,r)=>s+r.actual,0),10000000);
    assert.equal(k.rows.find(r=>r.productGroupId===product.id).hasTarget,false);
    await db.kpiTarget.create({data:{employeeId:ea.id,productGroupId:product.id,month:new Date(2026,9,1),targetRevenue:12000000}});
    k=await q.getKpiTable('2026-10');
    assert.equal(k.rows.reduce((s,r)=>s+r.actual,0),10000000);
    assert.equal(k.rows.filter(r=>r.productGroupId===product.id).length,1);
    assert.equal(k.employeeSummary[0].actual,10000000);
    assert.equal(k.rows[0].hasTarget,true);
  });
  await check('SALES B cannot collect / renew / read SALES A billing',async()=>{await deny(()=>billing.collectPayment(ctxB,{...pay,receiptKey:tag+'foreign',reference:'foreign'}));await deny(()=>billing.changeContract(ctxB,cid,'2026-05-31','ACTIVE'));await deny(()=>billing.billingForDeal(ctxB,da.id));});
  await check('Ledger order cannot be deleted separately from receipt',async()=>{const o=await db.order.findFirst({where:{dealId:da.id}});await deny(()=>actions.deleteOrder(o.id));});
  await check('Monthly renewal retains Jan 31 anchor and blocks expired cycle',async()=>{await billing.issuePeriod(ctxA,cid,'2026-02-28',1);const p=await db.billingPeriod.findUnique({where:{contractId_cycle:{contractId:cid,cycle:1}}});assert.equal(p.startsOn.toISOString().slice(0,10),'2026-02-28');assert.equal(p.endsOn.toISOString().slice(0,10),'2026-03-31');await deny(()=>billing.issuePeriod(ctxA,cid,'2026-03-31',2));await billing.changeContract(ctxA,cid,'2026-04-30','ACTIVE');await billing.issuePeriod(ctxA,cid,'2026-03-31',2);});
  await check('Paused contract blocks next period',async()=>{await billing.changeContract(ctxA,cid,'2026-05-31','PAUSED');await deny(()=>billing.issuePeriod(ctxA,cid,'2026-04-30',3));});
  await check('VAT accepts two decimal rates without binary rounding errors',async()=>assert.equal(await billing.openContract(ctxA,{...input,vatRate:20.01}),cid));
  await check('Invalid dates, money and VAT rejected',async()=>{assert.throws(()=>billing.dateOnly('2026-02-30'));assert.throws(()=>billing.money(-1));assert.throws(()=>billing.money(1.5));await deny(()=>billing.openContract(ctxA,{...input,vatRate:101}));});
  console.log(JSON.stringify({passed:checks.length,checks},null,2));
}
async function cleanup() {
  const ids=[da?.id,dbb?.id].filter(Boolean);
  await db.order.deleteMany({where:{dealId:{in:ids}}});
  await db.servicePayment.deleteMany({where:{period:{contract:{dealId:{in:ids}}}}});
  await db.billingPeriod.deleteMany({where:{contract:{dealId:{in:ids}}}});
  await db.serviceContract.deleteMany({where:{dealId:{in:ids}}});
  await db.deal.deleteMany({where:{id:{in:ids}}});
  await db.contact.deleteMany({where:{customerId:{in:[ca?.id,cb?.id].filter(Boolean)}}});
  await db.customer.deleteMany({where:{code:{startsWith:tag}}});
  await db.kpiTarget.deleteMany({where:{employeeId:{in:[ea?.id,eb?.id].filter(Boolean)}}});
  await db.user.deleteMany({where:{email:{startsWith:tag}}});
  await db.employee.deleteMany({where:{code:{startsWith:tag}}});
  if(stage)await db.pipelineStage.delete({where:{id:stage.id}});if(product)await db.productGroup.delete({where:{id:product.id}});
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await cleanup();await db.$disconnect()});
