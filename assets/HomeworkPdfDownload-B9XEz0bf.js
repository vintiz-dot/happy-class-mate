import{r as nt,j as c,B as j,L as E,s as it,l as Z}from"./index-Cfxe1HbK.js";import{E as st,h as Q}from"./html2canvas.esm-CKz4QK3H.js";import{n as dt,l as lt}from"./pdfExportLog-LCaqZiga.js";import{D as L}from"./download-DeiGvy5C.js";const ct=210,G=297,s=15,R=ct-s*2,V=G-s*2,I=720,T=R/I,tt=2;function yt({homework:r,className:P,teacherName:$,variant:f="button"}){const[n,k]=nt.useState(!1),m=async()=>{var q,B,W,U;k(!0);const et=dt(),d=(i,v,S)=>lt({level:i,step:v,exportId:et,homeworkId:r.id,homeworkTitle:r.title,data:S});d("info","export.start",{variant:f,hasBody:!!r.body,bodyLen:(r.body||"").length});try{let i=$||"",v=P||((q=r.classes)==null?void 0:q.name)||"";if((!i||i==="—")&&r.class_id){const{data:_}=await it.from("classes").select("name, default_teacher_id, teachers(full_name)").eq("id",r.class_id).single();_&&(v||(v=_.name||""),i=((B=_.teachers)==null?void 0:B.full_name)||"—")}const S=pt(r.body||""),e=document.createElement("div");e.style.position="fixed",e.style.left="0",e.style.top="0",e.style.zIndex="-1",e.style.opacity="0",e.style.pointerEvents="none",e.style.width=`${I}px`,e.style.padding="0",e.style.background="white",e.style.color="#1a1a1a",e.style.fontFamily="Helvetica, Arial, sans-serif",e.style.boxSizing="border-box",e.style.fontSize="13px",e.style.lineHeight="1.6";const ot=r.due_date?new Date(r.due_date).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"}):"No due date",at=r.created_at?new Date(r.created_at).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"}):"—";e.innerHTML=`
        <div data-pdf-block style="text-align: center; padding-bottom: 8px;">
          <img src="/images/hec_logo.png" crossorigin="anonymous" style="width: 80px; height: auto; margin: 0 auto 8px; display: block;" onerror="this.style.display='none'" />
          <h1 style="font-size: 20px; font-weight: bold; color: #d4a017; margin: 0;">Happy English Club</h1>
          <p style="font-size: 11px; color: #666; margin: 4px 0 0;">Learning, an endless journey to perfection</p>
          <hr style="border: none; border-top: 2px solid #d4a017; margin: 10px 0 0;" />
        </div>
        <div data-pdf-block style="padding-top: 10px;">
          <h2 style="font-size: 18px; font-weight: bold; margin: 0 0 12px; color: #111; word-wrap: break-word; overflow-wrap: anywhere;">${F(r.title)}</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; table-layout: fixed;">
            <tr>
              <td style="padding: 6px 8px; background: #f5f5f5; border: 1px solid #ddd; font-weight: bold; width: 110px;">Class</td>
              <td style="padding: 6px 8px; border: 1px solid #ddd; word-wrap: break-word; overflow-wrap: anywhere;">${F(v||"—")}</td>
            </tr>
            <tr>
              <td style="padding: 6px 8px; background: #f5f5f5; border: 1px solid #ddd; font-weight: bold;">Teacher</td>
              <td style="padding: 6px 8px; border: 1px solid #ddd; word-wrap: break-word; overflow-wrap: anywhere;">${F(i||"—")}</td>
            </tr>
            <tr>
              <td style="padding: 6px 8px; background: #f5f5f5; border: 1px solid #ddd; font-weight: bold;">Due Date</td>
              <td style="padding: 6px 8px; border: 1px solid #ddd;">${ot}</td>
            </tr>
            <tr>
              <td style="padding: 6px 8px; background: #f5f5f5; border: 1px solid #ddd; font-weight: bold;">Posted</td>
              <td style="padding: 6px 8px; border: 1px solid #ddd;">${at}</td>
            </tr>
          </table>
        </div>
        ${S?`
          <div data-pdf-block style="padding-top: 14px;">
            <h3 style="font-size: 14px; font-weight: bold; margin: 0 0 8px; color: #333;">Instructions</h3>
          </div>
          <div id="pdf-body-root" class="hw-body" style="font-size: 13px; line-height: 1.7; color: #333;">
            ${S}
          </div>
        `:""}
        <div data-pdf-block data-pdf-footer style="margin-top: 18px; padding-top: 10px; border-top: 1px solid #ddd; text-align: center; font-size: 10px; color: #999;">
          Happy English Club &bull; Generated on ${new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})}
        </div>
        <style>
          .hw-body { word-wrap: break-word; overflow-wrap: anywhere; }
          .hw-body * { max-width: 100% !important; overflow-wrap: anywhere !important; word-break: break-word !important; box-sizing: border-box; }
          .hw-body a { color: #2563eb !important; text-decoration: underline !important; font-weight: 600 !important; }
          .hw-body img { max-width: 100% !important; height: auto !important; display: block; margin: 8px 0; }
          .hw-body p { margin: 0 0 10px !important; }
          .hw-body h1, .hw-body h2, .hw-body h3, .hw-body h4 { margin: 12px 0 8px !important; line-height: 1.3 !important; }
          .hw-body ul, .hw-body ol { padding-left: 22px !important; margin: 0 0 10px !important; }
          .hw-body li { margin-bottom: 4px !important; }
          .hw-body blockquote { border-left: 3px solid #d4a017; padding-left: 10px; margin: 8px 0; color: #555; }
          .hw-body pre, .hw-body code { white-space: pre-wrap !important; background: #f5f5f5; padding: 6px; border-radius: 4px; font-family: monospace; font-size: 12px; }
          .hw-body table { width: 100% !important; table-layout: fixed !important; border-collapse: collapse !important; margin: 8px 0 !important; }
          .hw-body td, .hw-body th { padding: 6px 8px !important; border: 1px solid #ddd !important; word-wrap: break-word !important; font-size: 12px !important; vertical-align: top; }
        </style>
      `,document.body.appendChild(e);const O=`${r.title.replace(/[^a-zA-Z0-9]/g,"_")}_homework.pdf`,g=new st("p","mm","a4");try{if((W=document.fonts)!=null&&W.ready)try{await document.fonts.ready}catch{}const _=Array.from(e.querySelectorAll("img"));await Promise.all(_.map(t=>new Promise(o=>{if(t.complete&&t.naturalHeight>0)return o();t.onload=()=>o(),t.onerror=()=>o(),setTimeout(()=>o(),1500)}))),await new Promise(t=>requestAnimationFrame(()=>t(null))),await new Promise(t=>setTimeout(t,50));const A=[];e.querySelectorAll(":scope > [data-pdf-block]").forEach(t=>{t.hasAttribute("data-pdf-footer")||A.push(t)});const N=e.querySelector("#pdf-body-root");if(N){const t=Array.from(N.children);t.length===0&&((U=N.textContent)!=null&&U.trim())?A.push(N):t.forEach(o=>A.push(o))}const J=e.querySelector("[data-pdf-footer]");let p=s;const Y=t=>{p+t>G-s&&(g.addPage(),p=s)},rt=async t=>{if(!(!t||t.offsetWidth===0||t.offsetHeight===0))try{const o=await Q(t,{backgroundColor:"#ffffff",scale:2,useCORS:!0,logging:!1,windowWidth:I});if(o.width===0||o.height===0)return;const D=R,C=o.height*D/o.width;if(C>V){const y=V,u=C;let w=0;for(;w<u;){const b=u-w,l=Math.min(y,b),a=document.createElement("canvas"),M=o.width/D,x=Math.floor(l*M),z=Math.floor(w*M);a.width=o.width,a.height=x;const h=a.getContext("2d");if(!h)break;h.fillStyle="#ffffff",h.fillRect(0,0,a.width,a.height),h.drawImage(o,0,z,o.width,x,0,0,o.width,x),p!==s&&(g.addPage(),p=s),g.addImage(a.toDataURL("image/jpeg",.92),"JPEG",s,p,D,l),p+=l,w+=l,w<u&&(g.addPage(),p=s)}p+=tt;return}Y(C);const X=p;g.addImage(o.toDataURL("image/jpeg",.92),"JPEG",s,X,D,C);try{const y=t.getBoundingClientRect(),u=Array.from(t.querySelectorAll("a"));u.length>0&&d("info","links.found",{count:u.length}),u.forEach((w,b)=>{const l=w.getAttribute("href")||"";try{if(!l){d("warn","links.skip.no-href",{idx:b});return}const a=w.getBoundingClientRect();if(!a||a.width===0||a.height===0){d("warn","links.skip.zero-rect",{idx:b,href:l});return}const M=a.top-y.top,x=a.left-y.left;if(M<0||x<0){d("warn","links.skip.negative-offset",{idx:b,href:l,relTop:M,relLeft:x});return}const z=s+x*T,h=X+M*T,K=Math.min(a.width*T,D),H=a.height*T;if(h+H>G-s){d("warn","links.skip.out-of-page",{idx:b,href:l,yMm:h,hMm:H});return}g.link(z,h,K,H,{url:l}),d("info","links.mapped",{idx:b,href:l,xMm:z,yMm:h,wMm:K,hMm:H})}catch(a){d("error","links.map-error",{idx:b,href:l,message:a==null?void 0:a.message,stack:a==null?void 0:a.stack})}})}catch(y){d("error","links.outer-error",{message:y==null?void 0:y.message})}p+=C+tt}catch(o){console.warn("Block render skipped:",o)}};for(const t of A)await rt(t);if(J){const t=await Q(J,{backgroundColor:"#ffffff",scale:2,useCORS:!0,logging:!1,windowWidth:I}),o=t.height*R/t.width;Y(o),g.addImage(t.toDataURL("image/jpeg",.92),"JPEG",s,p,R,o)}try{g.save(O),d("info","export.saved",{fileName:O}),Z.success("PDF downloaded!")}catch(t){throw d("error","export.save-error",{message:t==null?void 0:t.message,stack:t==null?void 0:t.stack}),t}}finally{e.parentNode&&document.body.removeChild(e)}}catch(i){console.error("PDF generation error:",i),d("error","export.fatal",{message:i==null?void 0:i.message,stack:i==null?void 0:i.stack}),Z.error("Failed to generate PDF — check Teacher Profile → PDF Diagnostics for details")}finally{k(!1)}};return f==="icon"?c.jsx(j,{variant:"ghost",size:"icon",onClick:m,disabled:n,title:"Download as PDF",children:n?c.jsx(E,{className:"h-4 w-4 animate-spin"}):c.jsx(L,{className:"h-4 w-4"})}):f==="pill-compact"?c.jsxs(j,{onClick:m,disabled:n,size:"sm",className:"h-8 rounded-full gap-1.5 px-3 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm font-semibold text-xs",children:[n?c.jsx(E,{className:"h-3.5 w-3.5 animate-spin"}):c.jsx(L,{className:"h-3.5 w-3.5"}),"PDF"]}):f==="pill"?c.jsxs(j,{onClick:m,disabled:n,className:"h-10 min-h-[40px] rounded-full gap-2 px-4 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md font-semibold",children:[n?c.jsx(E,{className:"h-4 w-4 animate-spin"}):c.jsx(L,{className:"h-4 w-4"}),n?"Generating...":"Download PDF"]}):c.jsxs(j,{variant:"outline",size:"sm",onClick:m,disabled:n,className:"gap-2",children:[n?c.jsx(E,{className:"h-4 w-4 animate-spin"}):c.jsx(L,{className:"h-4 w-4"}),n?"Generating...":"Download PDF"]})}function F(r){return r.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function pt(r){if(!r)return"";const P=document.createElement("div");return P.innerHTML=r,P.querySelectorAll("a").forEach(f=>{const n=(f.getAttribute("href")||"").trim();if(!n)return;f.setAttribute("target","_blank"),f.setAttribute("rel","noopener noreferrer");const k=(f.textContent||"").trim();if(k&&k!==n&&!k.includes(n)){const m=document.createElement("span");m.style.color="#666",m.style.fontSize="0.9em",m.textContent=` (${n})`,f.after(m)}}),P.innerHTML}export{yt as H};
