// Small dependency-free PDF exporter. Generates a downloadable A4 PDF without popups.
export type PdfRow = string[]
const esc=(s:string)=>s.replace(/[^\x20-\x7e]/g,'?').replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)')
const safe=(v:unknown)=>String(v??'').replace(/₹/g,'Rs. ').replace(/[–—]/g,'-')
export function downloadStatementPdf(filename:string, title:string, info:string[], columns:string[], rows:PdfRow[], summary:string[]){
 const pages:string[][]=[];let lines:string[]=[]
 const add=(s:string)=>{if(lines.length>=49){pages.push(lines);lines=[]}lines.push(s)}
 add(title);info.forEach(x=>add(x));add('');add(columns.join('   |   '));add('-'.repeat(90))
 rows.forEach(r=>{const str=r.map((v,i)=>safe(v).slice(0,i===2?34:18)).join('  |  ');add(str.slice(0,105))})
 add('');summary.forEach(x=>add(x));if(lines.length)pages.push(lines)
 const objects:string[]=[''];const obj=(v:string)=>{objects.push(v);return objects.length-1}
 const font=obj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
 const bold=obj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>')
 const pageRefs:number[]=[]
 const contentRefs:number[]=[]
 for(const [pi,page] of pages.entries()){
  let stream='0.08 0.43 0.32 rg 0 774 595 68 re f\n'
  stream+='BT /F2 17 Tf 1 1 1 rg 38 805 Td ('+esc(safe(title).slice(0,70))+') Tj ET\n'
  page.slice(1).forEach((line,i)=>{const y=751-i*14;const isSummary=line.startsWith('Closing')||line.startsWith('Outstanding')||line.startsWith('Total')
   stream+='BT /'+(isSummary?'F2':'F1')+' '+(isSummary?'10':'9')+' Tf 0.10 0.16 0.24 rg 38 '+y+' Td ('+esc(safe(line).slice(0,108))+') Tj ET\n'
  })
  stream+='BT /F1 8 Tf 0.45 0.5 0.55 rg 38 32 Td (Banke Vihari Fertilizer  |  Page '+(pi+1)+' of '+pages.length+') Tj ET\n'
  const c=obj('<< /Length '+new TextEncoder().encode(stream).length+' >>\nstream\n'+stream+'endstream');contentRefs.push(c)
  const p=obj('');pageRefs.push(p)
 }
 const pagesId=obj('');pageRefs.forEach((p,i)=>{objects[p]='<< /Type /Page /Parent '+pagesId+' 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 '+font+' 0 R /F2 '+bold+' 0 R >> >> /Contents '+contentRefs[i]+' 0 R >>'})
 objects[pagesId]='<< /Type /Pages /Kids ['+pageRefs.map(p=>p+' 0 R').join(' ')+'] /Count '+pageRefs.length+' >>'
 const catalog=obj('<< /Type /Catalog /Pages '+pagesId+' 0 R >>')
 let pdf='%PDF-1.4\n';const offsets=[0]
 for(let i=1;i<objects.length;i++){offsets[i]=new TextEncoder().encode(pdf).length;pdf+=i+' 0 obj\n'+objects[i]+'\nendobj\n'}
 const xref=new TextEncoder().encode(pdf).length;pdf+='xref\n0 '+objects.length+'\n0000000000 65535 f \n'
 for(let i=1;i<objects.length;i++)pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n'
 pdf+='trailer\n<< /Size '+objects.length+' /Root '+catalog+' 0 R >>\nstartxref\n'+xref+'\n%%EOF'
 const blob=new Blob([pdf],{type:'application/pdf'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000)
}
