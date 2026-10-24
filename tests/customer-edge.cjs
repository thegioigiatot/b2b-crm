/* eslint-disable @typescript-eslint/no-require-imports -- Adapt Next request APIs for PostgreSQL integration testing. */
const assert=require('node:assert/strict');const Module=require('node:module');let currentUser;
const original=Module._load;Module._load=function(name,...args){
 if(name==='server-only')return{};
 if(name==='next/headers')return{cookies:async()=>({get:key=>key==='dev_uid'&&currentUser?{value:currentUser}:undefined})};
 if(name==='next/cache')return{revalidatePath(){}};
 if(name==='next/navigation')return{redirect:path=>{const e=new Error('NEXT_REDIRECT:'+path);e.digest=`NEXT_REDIRECT;replace;${path};307;`;throw e}};
 return original.call(this,name,...args);
};
const{prisma:p}=require('../lib/prisma.ts');const{upsertCustomer,deleteCustomer}=require('../lib/actions.ts');const{saveCustomerForm}=require('../lib/customer-form-actions.ts');const{deleteContact}=require('../lib/deal-actions.ts');
const tag='EDGE-'+Date.now(),checks=[];let ea,eb,ua,ub,admin,stage;
const form=obj=>{const f=new FormData();for(const[k,v]of Object.entries(obj))if(v!=null)f.set(k,String(v));return f};
async function check(name,fn){await fn();checks.push({name,pass:true});console.log('PASS '+name)}
async function redirected(fn){await assert.rejects(fn,e=>e.message.startsWith('NEXT_REDIRECT:'))}
async function create(suffix,data={}){return p.customer.create({data:{code:tag+suffix,name:tag+suffix,employeeId:ea.id,...data}})}
function edit(c,data={}){return form({id:c.id,updatedAt:c.updatedAt.toISOString(),code:c.code,name:c.name,employeeId:c.employeeId,phone:c.phone,notes:c.notes,...data})}
async function main(){
 if(!process.env.DATABASE_URL?.includes('_test'))throw Error('Use an isolated *_test database only.');
 ea=await p.employee.create({data:{code:tag+'EA',name:tag+' A'}});eb=await p.employee.create({data:{code:tag+'EB',name:tag+' B'}});
 ua=await p.user.create({data:{email:tag+'a@example.invalid',active:true,role:'SALES',employeeId:ea.id,extraPerms:JSON.stringify({deleteRecords:true})}});
 ub=await p.user.create({data:{email:tag+'b@example.invalid',active:true,role:'SALES',employeeId:eb.id}});
 admin=await p.user.create({data:{email:tag+'admin@example.invalid',active:true,role:'ADMIN'}});
 stage=await p.pipelineStage.create({data:{name:tag+' stage'}});currentUser=ua.id;
 await check('Blank/whitespace code or name rejected',async()=>{for(const fields of [{code:' ',name:'N'},{code:'C',name:' '}])await assert.rejects(()=>upsertCustomer(form(fields)),/không được để trống/)});
 await check('Impossible birth date rejected without creating customer',async()=>await assert.rejects(()=>upsertCustomer(form({code:tag+'BAD',name:'BAD',dob:'2026-02-30'})),/Ngày sinh không hợp lệ/));
 let customer;
 await check('Create customer and report duplicate code inline without second record',async()=>{
  const f=form({code:tag+'MAIN',name:'Original',employeeId:ea.id,phone:'111',notes:'Original notes'});
  await redirected(()=>upsertCustomer(f));customer=await p.customer.findUniqueOrThrow({where:{code:tag+'MAIN'}});
  const result=await saveCustomerForm(f);assert.match(result.error,/Mã khách hàng đã tồn tại/);assert.equal(await p.customer.count({where:{code:tag+'MAIN'}}),1);
 });
 await p.order.create({data:{customerId:customer.id,employeeId:ea.id,date:new Date('2026-10-24'),isClosed:true,value:12345}});
 await p.contact.create({data:{customerId:customer.id,name:'Contact'}});
 await check('Edit existing customer with revenue preserves Order and clears optional text',async()=>{
  await redirected(()=>upsertCustomer(edit(customer,{name:'Updated',phone:'',notes:''})));
  const c=await p.customer.findUniqueOrThrow({where:{id:customer.id},include:{orders:true,contacts:true}});
  assert.equal(c.name,'Updated');assert.equal(c.phone,null);assert.equal(c.notes,null);assert.equal(c.orders[0].value,12345);assert.equal(c.contacts.length,1);
 });
 await check('Stale edit cannot overwrite latest changes',async()=>{await assert.rejects(()=>upsertCustomer(edit(customer,{name:'Stale overwrite'})),/biểu mẫu đã cũ/);assert.equal((await p.customer.findUniqueOrThrow({where:{id:customer.id}})).name,'Updated')});
 await check('Missing version rejected',async()=>{const c=await p.customer.findUniqueOrThrow({where:{id:customer.id}});const f=edit(c);f.delete('updatedAt');await assert.rejects(()=>upsertCustomer(f),/biểu mẫu đã cũ/)});
 await check('Foreign SALES cannot edit or delete another owner record',async()=>{currentUser=ub.id;await assert.rejects(()=>upsertCustomer(edit(customer,{name:'Attack'})),/quyền/);await assert.rejects(()=>deleteCustomer(customer.id,customer.code),/quyền/);currentUser=ua.id});
 await check('Even ADMIN cannot reassign customer with dependent data',async()=>{currentUser=admin.id;const c=await p.customer.findUniqueOrThrow({where:{id:customer.id}});await assert.rejects(()=>upsertCustomer(edit(c,{employeeId:eb.id})),/chuyển đồng bộ nhân viên/);assert.equal((await p.customer.findUniqueOrThrow({where:{id:customer.id}})).employeeId,ea.id);currentUser=ua.id});
 await check('Invalid catalogue reference returns safe error and rolls back edit',async()=>{const c=await p.customer.findUniqueOrThrow({where:{id:customer.id}});const r=await saveCustomerForm(edit(c,{provinceId:'missing-catalog-id',name:'Must rollback'}));assert.match(r.error,/chọn lại danh mục/);assert.equal((await p.customer.findUniqueOrThrow({where:{id:customer.id}})).name,'Updated')});
 await check('Concurrent edits with same version allow exactly one save',async()=>{
  const c=await p.customer.findUniqueOrThrow({where:{id:customer.id}});
  const results=await Promise.allSettled([upsertCustomer(edit(c,{notes:'First'})),upsertCustomer(edit(c,{notes:'Second'}))]);
  assert.equal(results.filter(x=>x.status==='rejected'&&x.reason.message.startsWith('NEXT_REDIRECT:')).length,1);
  assert.equal(results.filter(x=>x.status==='rejected'&&/biểu mẫu đã cũ/.test(x.reason.message)).length,1);
 });
 const dependencies={
  contact:c=>p.contact.create({data:{customerId:c.id,name:'Test'}}),
  order:c=>p.order.create({data:{customerId:c.id,date:new Date(),isClosed:true,value:10}}),
  deal:c=>p.deal.create({data:{customerId:c.id,ownerId:ea.id,stageId:stage.id,code:c.code,title:'Test'}}),
  task:c=>p.task.create({data:{customerId:c.id,title:'Test',employeeId:ea.id}}),
  careLog:c=>p.careLog.create({data:{customerId:c.id,date:new Date(),content:'Test'}}),
  document:c=>p.customerDocument.create({data:{customerId:c.id,name:'Test'}}),
  convertedLead:c=>p.lead.create({data:{convertedCustomerId:c.id,code:c.code,name:'Test',employeeId:ea.id}}),
 };
 for(const[type,add]of Object.entries(dependencies))await check('Delete blocked with dependency: '+type,async()=>{const c=await create(type);await add(c);await assert.rejects(()=>deleteCustomer(c.id,c.code),/Không thể xoá/);assert.ok(await p.customer.findUnique({where:{id:c.id}}))});
 await check('Delete requires exact code; empty record deletes safely and retry is harmless',async()=>{const c=await create('EMPTY');await assert.rejects(()=>deleteCustomer(c.id,'WRONG'),/Nhập đúng mã/);await redirected(()=>deleteCustomer(c.id,c.code));assert.equal(await p.customer.findUnique({where:{id:c.id}}),null);await redirected(()=>deleteCustomer(c.id,c.code));assert.ok(await p.customer.findUnique({where:{id:customer.id}}))});
 await check('Contact referenced by a deal cannot be deleted',async()=>{const c=await create('CONTACT-USED');const contact=await p.contact.create({data:{customerId:c.id,name:'Used'}});await p.deal.create({data:{customerId:c.id,contactId:contact.id,ownerId:ea.id,stageId:stage.id,code:c.code,title:'Linked'}});await assert.rejects(()=>deleteContact(contact.id,c.id),/Contact đang được dùng/);assert.ok(await p.contact.findUnique({where:{id:contact.id}}))});
 await check('Default SALES cannot delete own empty customer',async()=>{const c=await create('NO-DELETE',{employeeId:eb.id});currentUser=ub.id;await assert.rejects(()=>deleteCustomer(c.id,c.code),/Không có quyền xoá/);assert.ok(await p.customer.findUnique({where:{id:c.id}}));currentUser=ua.id});
 await check('Concurrent duplicate create stores one customer and returns a friendly conflict',async()=>{const f=()=>form({code:tag+'RACE',name:'Race',employeeId:ea.id});const r=await Promise.allSettled([saveCustomerForm(f()),saveCustomerForm(f())]);assert.equal(r.filter(x=>x.status==='fulfilled'&&/đã tồn tại/.test(x.value.error||'')).length,1);assert.equal(await p.customer.count({where:{code:tag+'RACE'}}),1)});
 console.log(JSON.stringify({passed:checks.length,checks},null,2));
}
async function cleanup(){
 const cs=await p.customer.findMany({where:{code:{startsWith:tag}},select:{id:true}});const ids=cs.map(c=>c.id);
 await p.order.deleteMany({where:{customerId:{in:ids}}});await p.deal.deleteMany({where:{customerId:{in:ids}}});await p.lead.deleteMany({where:{convertedCustomerId:{in:ids}}});await p.task.deleteMany({where:{customerId:{in:ids}}});await p.careLog.deleteMany({where:{customerId:{in:ids}}});await p.customerDocument.deleteMany({where:{customerId:{in:ids}}});await p.contact.deleteMany({where:{customerId:{in:ids}}});await p.customer.deleteMany({where:{id:{in:ids}}});
 await p.user.deleteMany({where:{email:{startsWith:tag}}});await p.employee.deleteMany({where:{code:{startsWith:tag}}});if(stage)await p.pipelineStage.delete({where:{id:stage.id}});
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await cleanup();await p.$disconnect()});
