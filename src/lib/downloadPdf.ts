// Downloadable, paginated A4 ledger PDF with designed tables and financial summary.
export type PdfRow = string[]
const ascii=(v:unknown)=>String(v??'').replace(/₹/g,'Rs. ').replace(/[–—]/g,'-').replace(/[^\x20-\x7e]/g,' ')
const escapePdf=(v:unknown)=>ascii(v).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)')
const crop=(v:unknown,n:number)=>{const s=ascii(v);return s.length>n?s.slice(0,n-3)+'...':s}
export function downloadStatementPdf(filename:string,title:string,info:string[],columns:string[],rows:PdfRow[],summary:string[],invoice?:{columns:string[];rows:string[][];title:string}){
 const W=595,H=842,left=38,right=557;const streams:string[]=[]
 const rgb=(r:number,g:number,b:number)=>[r,g,b].map(x=>(x/255).toFixed(3)).join(' ')
 const green=rgb(5,112,82),dark=rgb(20,34,54),muted=rgb(100,116,139),pale=rgb(231,245,239),line=rgb(222,232,235)
 let stream='',y=0,page=0
 const rect=(x:number,top:number,w:number,h:number,fill:string)=>{stream+=fill+' rg '+x+' '+(H-top-h)+' '+w+' '+h+' re f\n'}
 const text=(value:unknown,x:number,top:number,size=9,bold=false,color=dark)=>{stream+='BT /'+(bold?'F2':'F1')+' '+size+' Tf '+color+' rg 1 0 0 1 '+x+' '+(H-top-size)+' Tm ('+escapePdf(value)+') Tj ET\n'}
 const rule=(top:number)=>rect(left,top,right-left,0.8,line)
 const newPage=()=>{
  if(stream)streams.push(stream)
  stream='';page++
  rect(0,0,W,91,green)
  text('Banke Vihari Fertilizer',left,23,18,true,'1 1 1')
  text(title.toUpperCase().includes('CUSTOMER')?'CUSTOMER ACCOUNT STATEMENT  /  UDHAR KHATA':'SUPPLIER ACCOUNT STATEMENT  /  PURCHASE KHATA',left,52,8,false,'0.82 0.94 0.89')
  text(title.toUpperCase().includes('CUSTOMER')?'KHATA STATEMENT':'SUPPLIER STATEMENT',left,108,17,true,dark)
  text('ACCOUNT SUMMARY  |  '+new Date().toLocaleDateString('en-IN'),left,135,8,false,muted)
  y=160
 }
 newPage()
 const metadata=info.slice(1)
 rect(left,y,right-left,Math.max(65,metadata.length*16+24),rgb(246,249,250))
 metadata.forEach((v,i)=>text(crop(v,93),left+14,y+12+i*16,i===0?11:9,i===0,dark))
 y+=Math.max(65,metadata.length*16+24)+16
 const parseAmount=(s:string)=>{const m=ascii(s).match(/-?[\d,]+(?:\.\d+)?/);return m?Number(m[0].replace(/,/g,'')):0}
 const summaryItems=summary.slice(0,4)
 const cards=summaryItems.map(s=>{const p=s.indexOf(':');return{label:p>=0?s.slice(0,p):s,value:p>=0?s.slice(p+1).trim():''}})
 const cardWidth=(right-left-12)/2
 cards.forEach((c,i)=>{const x=left+(i%2)*(cardWidth+12),top=y+Math.floor(i/2)*62
  rect(x,top,cardWidth,53,i===3?pale:rgb(247,249,250))
  text(crop(c.label.toUpperCase(),34),x+12,top+9,8,false,muted)
  text(crop(c.value,31),x+12,top+25,13,true,i===3?green:dark)
 })
 y+=Math.ceil(cards.length/2)*62+12
 const colWidths=[27,82,176,78,78,78];const tableWidth=colWidths.reduce((a,b)=>a+b,0)
 const tableHeader=()=>{rect(left,y,tableWidth,31,green);let x=left
  columns.forEach((c,i)=>{text(crop(c,i===2?25:13),x+6,y+9,8,true,'1 1 1');x+=colWidths[i]||70})
  y+=31
 }
 const tableTitle=()=>{text('Transaction ledger (complete statement)',left,y,11,true,dark);y+=22;tableHeader()}
 tableTitle()
 if(!rows.length){rect(left,y,tableWidth,39,rgb(249,251,252));text('No ledger transactions recorded',left+12,y+13,9,false,muted);y+=39}
 rows.forEach((r,i)=>{
  if(y>742){newPage();tableTitle()}
  rect(left,y,tableWidth,32,i%2?rgb(247,250,249):'1 1 1')
  let x=left;r.slice(0,6).forEach((v,j)=>{text(crop(v,j===2?30:j===1?13:12),x+6,y+10,j===5?8.5:8,j===5,dark);x+=colWidths[j]})
  rect(left,y+31,tableWidth,0.6,line);y+=32
 })
 if(y>686){newPage()}
 y+=16
 if(invoice){
  if(y>680)newPage()
  text(invoice.title,left,y,11,true,dark);y+=25
  const widths=[92,145,82,67,67,66]
  const head=()=>{rect(left,y,tableWidth,30,pale);let x=left;invoice.columns.forEach((v,i)=>{text(crop(v,18),x+5,y+9,8,true,green);x+=widths[i]||60});rect(left,y+29,tableWidth,2,green);y+=31}
  head()
  if(!invoice.rows.length){text('No invoices recorded',left+8,y+10,9,false,muted);y+=30}
  invoice.rows.forEach((r,i)=>{if(y>740){newPage();text(invoice.title+' (continued)',left,y,11,true,dark);y+=24;head()}rect(left,y,tableWidth,29,i%2?rgb(248,250,250):'1 1 1');let x=left;r.slice(0,6).forEach((v,j)=>{text(crop(v,j===1?22:14),x+5,y+9,8,j===5,dark);x+=widths[j]});rect(left,y+28,tableWidth,.6,line);y+=29})
 }
 if(y>728)newPage()
 y+=16;rule(y);y+=12
 summary.slice(4).forEach(s=>{if(y>744)newPage();text(crop(s,90),left,y,9,true,dark);y+=17})
 const objects:string[]=[''];const obj=(v:string)=>{objects.push(v);return objects.length-1}
 const f1=obj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'),f2=obj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>')
 if(stream)streams.push(stream)
 const pages:number[]=[],contents:number[]=[]
 streams.forEach((s,i)=>{s+=rgb(225,233,235)+' rg 38 44 519 1 re f\n'
  s+='BT /F1 8 Tf '+muted+' rg 1 0 0 1 38 29 Tm (Computer-generated statement  |  Banke Vihari Fertilizer) Tj ET\n'
  s+='BT /F1 8 Tf '+muted+' rg 1 0 0 1 491 29 Tm (Page '+(i+1)+' of '+streams.length+') Tj ET\n'
  const c=obj('<< /Length '+new TextEncoder().encode(s).length+' >>\nstream\n'+s+'endstream');contents.push(c);pages.push(obj(''))
 })
 const pagesId=obj('');pages.forEach((p,i)=>objects[p]='<< /Type /Page /Parent '+pagesId+' 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 '+f1+' 0 R /F2 '+f2+' 0 R >> >> /Contents '+contents[i]+' 0 R >>')
 objects[pagesId]='<< /Type /Pages /Kids ['+pages.map(p=>p+' 0 R').join(' ')+'] /Count '+pages.length+' >>'
 const root=obj('<< /Type /Catalog /Pages '+pagesId+' 0 R >>')
 let pdf='%PDF-1.4\n';const offsets=[0]
 for(let i=1;i<objects.length;i++){offsets[i]=new TextEncoder().encode(pdf).length;pdf+=i+' 0 obj\n'+objects[i]+'\nendobj\n'}
 const xref=new TextEncoder().encode(pdf).length;pdf+='xref\n0 '+objects.length+'\n0000000000 65535 f \n'
 for(let i=1;i<objects.length;i++)pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n'
 pdf+='trailer\n<< /Size '+objects.length+' /Root '+root+' 0 R >>\nstartxref\n'+xref+'\n%%EOF'
 const url=URL.createObjectURL(new Blob([pdf],{type:'application/pdf'}))
 const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000)
}
