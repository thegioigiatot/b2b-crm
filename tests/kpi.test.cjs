/* eslint-disable @typescript-eslint/no-require-imports -- Node test runner entry. */
const {test}=require('node:test');const assert=require('node:assert/strict');
const {buildKpiRows,parseKpiInput}=require('../lib/kpi.ts');
const employees=[{id:'e',name:'SALES'}],groups=[{id:'web',name:'Website'},{id:'press',name:'Báo chí'}];
const target={id:'t',employeeId:'e',productGroupId:'web',targetRevenue:60000000};
test('Regression: 40m targeted + 8m untargeted = 48m, not 40m',()=>{
 const rows=buildKpiRows([target],[{employeeId:'e',productGroupId:'web',actual:40000000},{employeeId:'e',productGroupId:'press',actual:8000000}],employees,groups);
 assert.equal(rows.reduce((s,r)=>s+r.actual,0),48000000);assert.equal(rows.reduce((s,r)=>s+r.target,0),60000000);
 const press=rows.find(r=>r.productGroupId==='press');assert.equal(press.hasTarget,false);assert.equal(press.target,0);
});
test('Adding/removing a target never duplicates or removes actual revenue',()=>{
 const actuals=[{employeeId:'e',productGroupId:'press',actual:8}];
 const t={...target,productGroupId:'press',targetRevenue:10};
 for(const targets of [[],[t],[]]){const rows=buildKpiRows(targets,actuals,employees,groups);assert.equal(rows.length,1);assert.equal(rows[0].actual,8);assert.equal(rows[0].hasTarget,targets.length===1);}
});
test('Target-only row remains; explicit zero is different from missing target',()=>{
 const rows=buildKpiRows([{...target,targetRevenue:0}],[],employees,groups);assert.equal(rows[0].hasTarget,true);assert.equal(rows[0].actual,0);assert.equal(rows[0].rate,0);
});
test('Legacy unassigned employee/service still contributes exactly once',()=>{
 const rows=buildKpiRows([],[{employeeId:null,productGroupId:null,actual:7},{employeeId:'e',productGroupId:null,actual:3}],employees,groups);
 assert.equal(rows.length,2);assert.equal(rows.reduce((s,r)=>s+r.actual,0),10);assert.ok(rows.some(r=>r.employeeName==='Chưa gán nhân viên'));assert.ok(rows.every(r=>r.productGroupName==='Chưa gán dịch vụ'));
});
test('Empty data and zero agency media-only collection do not create missing-target alerts',()=>{
 assert.deepEqual(buildKpiRows([],[],employees,groups),[]);assert.deepEqual(buildKpiRows([],[{employeeId:'e',productGroupId:'press',actual:0}],employees,groups),[]);
});
test('Reject negative/fractional/blank/nonfinite/oversized KPI amounts and invalid months',()=>{
 for(const v of ['-1','0.1','','NaN','Infinity','1000000000001'])assert.throws(()=>parseKpiInput('2026-10',v));
 for(const m of ['2026-00','2026-13','2026-1','2026-10-01','0099-10'])assert.throws(()=>parseKpiInput(m,'10'));
 assert.equal(parseKpiInput('2026-10','0').targetRevenue,0);assert.equal(parseKpiInput('2026-10','60000000').targetRevenue,60000000);
});
