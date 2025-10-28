/* app.js — zero left/right gutter for stacked bubbles
   - Sets PAD_X to 0 so layoutColumn() doesn't add an extra left/right offset
   - Width calc still respects borders; margins handled purely in CSS
*/
(function(){
  "use strict";

  const els = {
    templates: document.getElementById('templates'),
    canvas: document.getElementById('canvas'),
    addBtn: document.getElementById('addBtn'),
    modal: document.getElementById('modal'),
    form: document.getElementById('newBubbleForm'),
    input: document.getElementById('bubbleText'),
    cancelBtn: document.getElementById('cancelBtn'),
    sidebar: document.querySelector('aside.sidebar'),
    trash: document.getElementById('trash'),
    weekWrapper: document.querySelector('.week-table-wrapper'),
    weekTable: document.querySelector('.week-table'),
    colorPresets: document.getElementById('colorPresets'),
  };

  const CONST = Object.freeze({
    PAD_TOP: 8,
    PAD_X: 0,          // was 1 — now zero to remove the left/right gap
    COL_MARGIN_VW: 0.00, // remove tiny vw gutter entirely
    GAP: 6,
    STORAGE_KEY: 'bubbleTemplates.v1',
    CSS_MINH_FALLBACK: 360,
  });

  const PRESETS = [
    '#38bdf8','#22d3ee','#2dd4bf','#34d399','#4ade80','#a3e635','#fbbf24','#fb923c',
    '#f87171','#fb7185','#f472b6','#a78bfa','#c084fc','#60a5fa','#06b6d4','#10b981'
  ];

  const state = { zCounter: 1, currentDraggedTemplate: null };

  const U = {
    randomAccent(){
      const hues = [180,200,210,160,280,320];
      const h = hues[Math.floor(Math.random()*hues.length)];
      return `hsl(${h} 90% 60%)`;
    },
    clamp(v,min,max){ return Math.min(Math.max(v,min),max); },
    pointInRect(x,y,r){ return x>=r.left && x<=r.right && y>=r.top && y<=r.bottom; },
    overSidebarXY(x,y){ return U.pointInRect(x,y,els.sidebar.getBoundingClientRect()); },
    overTrashXY(x,y){ return U.pointInRect(x,y,els.trash.getBoundingClientRect()); },
    cssToRgb(str){
      if(!str) return {r:0,g:0,b:0};
      str = String(str).trim().toLowerCase();
      const mH = str.match(/^hsla?\(([^)]+)\)/i);
      if(mH){
        const parts = mH[1].replace(/\//g,' ').replace(/,/g,' ').trim().split(/\s+/);
        let h=parseFloat(parts[0]), s=parseFloat(parts[1]), l=parseFloat(parts[2]);
        if((parts[1]||'').includes('%')) s/=100; else if(s>1) s/=100;
        if((parts[2]||'').includes('%')) l/=100; else if(l>1) l/=100;
        if(!isFinite(h)||!isFinite(s)||!isFinite(l)) return {r:0,g:0,b:0};
        return U.hslToRgb(h,s,l);
      }
      const mR = str.match(/^rgba?\(([^)]+)\)/i);
      if(mR){
        const parts = mR[1].replace(/\//g,' ').replace(/,/g,' ').trim().split(/\s+/);
        return { r: +parts[0]||0, g: +parts[1]||0, b: +parts[2]||0 };
      }
      const mX = str.match(/^#([0-9a-f]{3,8})$/i);
      if(mX){
        const hex = mX[1];
        if(hex.length===3){
          const r=parseInt(hex[0]+hex[0],16), g=parseInt(hex[1]+hex[1],16), b=parseInt(hex[2]+hex[2],16);
          return {r,g,b};
        }
        if(hex.length>=6){
          const r=parseInt(hex.slice(0,2),16), g=parseInt(hex.slice(2,4),16), b=parseInt(hex.slice(4,6),16);
          return {r,g,b};
        }
      }
      const tmp = document.createElement('span');
      tmp.style.background = str; tmp.style.display='none'; document.body.appendChild(tmp);
      const rgb = getComputedStyle(tmp).backgroundColor; tmp.remove();
      return U.cssToRgb(rgb);
    },
    hslToRgb(h,s,l){
      h=((h%360)+360)%360; const c=(1-Math.abs(2*l-1))*s; const hp=h/60; const x=c*(1-Math.abs((hp%2)-1));
      let r1=0,g1=0,b1=0;
      if(hp<1){ r1=c; g1=x; }
      else if(hp<2){ r1=x; g1=c; }
      else if(hp<3){ g1=c; b1=x; }
      else if(hp<4){ g1=x; b1=c; }
      else if(hp<5){ r1=x; b1=c; }
      else { r1=c; }
      const m=l-c/2; return { r:Math.round((r1+m)*255), g:Math.round((g1+m)*255), b:Math.round((b1+m)*255) };
    },
    luminance(rgb){
      const toLin=v=>{ v/=255; return v<=0.03928? v/12.92 : Math.pow((v+0.055)/1.055,2.4); };
      const R=toLin(rgb.r), G=toLin(rgb.g), B=toLin(rgb.b);
      return 0.2126*R + 0.7152*G + 0.0722*B;
    },
    bestTextForBg(bg){
      const L=U.luminance(U.cssToRgb(bg));
      return (L>0.7)? '#334155' : '#f8fafc';
    }
  };

  const Store = {
    save(){
      const items = Array.from(els.templates.children).map(el=>({
        text: el.dataset.text || el.textContent.trim(),
        color: el.dataset.color || ''
      }));
      try{ localStorage.setItem(CONST.STORAGE_KEY, JSON.stringify(items)); }catch(_){}
    },
    load(){
      let initial=['Idea','Task','Note'];
      try{
        const raw=localStorage.getItem(CONST.STORAGE_KEY);
        if(raw){ const arr=JSON.parse(raw); if(Array.isArray(arr)&&arr.length) initial=arr; }
      }catch(_){ }
      initial.forEach(item=>{
        if(typeof item==='string') Sidebar.addTemplate(item);
        else if(item && typeof item.text==='string') Sidebar.addTemplate(item.text, item.color);
      });
    }
  };

  const Week = (()=>{
    const headerCells = Array.from(els.weekTable.querySelectorAll('thead tr th'));
    const dayCells = Array.from(els.weekTable.querySelectorAll('tbody tr:first-child td'));
    const stacks = new Array(dayCells.length).fill(0).map(()=>[]);

    const insertLine = document.createElement('div');
    insertLine.className='insert-line'; insertLine.hidden=true; document.body.appendChild(insertLine);

    let lastSnapCell=null, lastSnapHead=null;

    function getSnapCellAt(x,y){
      if(!els.weekTable||!els.weekWrapper) return {cell:null, inside:false};
      const wrapRect=els.weekWrapper.getBoundingClientRect();
      const inside = x>=wrapRect.left && x<=wrapRect.right && y>=wrapRect.top && y<=wrapRect.bottom;
      if(!inside) return {cell:null, inside:false};
      const cells = Array.from(els.weekTable.querySelectorAll('tbody td'));
      let best=null, bestDist=Infinity;
      for(const c of cells){
        const r=c.getBoundingClientRect(); const cx=r.left+r.width/2, cy=r.top+r.height/2;
        const dx=cx-x, dy=cy-y; const d=dx*dx+dy*dy; if(d<bestDist){ bestDist=d; best=c; }
      }
      return {cell:best, inside:true};
    }

    const getCellIndex = (cell)=> dayCells.indexOf(cell);

    function layoutColumn(col){
      const cell=dayCells[col]; if(!cell) return;
      const crect=els.canvas.getBoundingClientRect();
      const r=cell.getBoundingClientRect();
      const arr=stacks[col];
      const vw=(window.innerWidth||document.documentElement.clientWidth||0);
      const vwGutter = vw * (CONST.COL_MARGIN_VW/100);
      const left=(r.left - crect.left) + CONST.PAD_X + vwGutter;
      const usableWidth=Math.max(0, r.width - CONST.PAD_X*2 - vwGutter*2);
      let y=(r.top - crect.top) + CONST.PAD_TOP;
      arr.forEach(el=>{
        el.classList.add('stacked');
        el.style.position='absolute';
        el.style.width = usableWidth + 'px';
        el.style.zIndex = '';
        Canvas.placeWithin(el, left, y);
        y += el.offsetHeight + CONST.GAP;
      });
      return y - CONST.GAP;
    }

    function layoutAll(){
      let maxBottom=0;
      for(let c=0;c<stacks.length;c++){
        const bottom = layoutColumn(c) || 0; if(bottom>maxBottom) maxBottom=bottom;
      }
      const crect=els.canvas.getBoundingClientRect();
      const wrect=els.weekWrapper.getBoundingClientRect();
      const wrapperTopInCanvas = wrect.top - crect.top;
      const needed = Math.ceil(maxBottom - wrapperTopInCanvas + CONST.PAD_TOP);
      let minHraw = getComputedStyle(els.weekWrapper).getPropertyValue('--week-min-h');
      let minH = parseInt(minHraw);
      if(!isFinite(minH)) minH = CONST.CSS_MINH_FALLBACK;
      const newH = Math.max(needed, minH);
      els.weekWrapper.style.height = (isFinite(newH)? newH : minH) + 'px';
    }

    function removeFromStack(el){
      const col = el.dataset.stackCol; if(col===undefined) return;
      const i=parseInt(col,10); const arr=stacks[i]; const idx=arr.indexOf(el);
      if(idx!==-1) arr.splice(idx,1);
      delete el.dataset.stackCol; el.style.width=''; el.classList.remove('stacked');
      layoutAll();
    }

    function assignToStack(el, cell, pointerY){
      const col=getCellIndex(cell); if(col<0) return;
      const arr=stacks[col]; let insertAt=arr.length;
      for(let i=0;i<arr.length;i++){
        const other=arr[i]; const center=other.getBoundingClientRect().top + other.offsetHeight/2;
        if(pointerY<center){ insertAt=i; break; }
      }
      removeFromStack(el); arr.splice(insertAt,0,el); el.dataset.stackCol=String(col);
      el.style.zIndex='';
      layoutAll();
    }

    function setSnapHighlight(cell){
      if(lastSnapCell && lastSnapCell!==cell){ lastSnapCell.classList.remove('snap-target'); }
      if(lastSnapHead){ lastSnapHead.classList.remove('snap-target'); lastSnapHead=null; }
      if(cell){
        cell.classList.add('snap-target');
        const col=getCellIndex(cell); const head=headerCells[col];
        if(head){ head.classList.add('snap-target'); lastSnapHead=head; }
      }
      lastSnapCell = cell || null;
    }

    function clearSnapHighlight(){
      if(lastSnapCell){ lastSnapCell.classList.remove('snap-target'); lastSnapCell=null; }
      if(lastSnapHead){ lastSnapHead.classList.remove('snap-target'); lastSnapHead=null; }
    }

    function hideInsertLine(){ insertLine.hidden=true; }

    function updateInsertLine(cell, pointerY){
      if(!cell){ hideInsertLine(); return; }
      const col=getCellIndex(cell); if(col<0){ hideInsertLine(); return; }
      const r=cell.getBoundingClientRect(); const arr=stacks[col]; if(!arr||arr.length===0){ hideInsertLine(); return; }
      const vw=(window.innerWidth||document.documentElement.clientWidth||0);
      const vwGutter = vw * (CONST.COL_MARGIN_VW/100);
      const left = r.left + CONST.PAD_X + vwGutter;
      const width = Math.max(0, r.width - CONST.PAD_X*2 - vwGutter*2);
      let yGuide = r.top + CONST.PAD_TOP;
      for(let i=0;i<arr.length;i++){
        const other=arr[i]; const center=other.getBoundingClientRect().top + other.offsetHeight/2;
        if(pointerY<center){ yGuide = other.getBoundingClientRect().top; break; }
        yGuide = other.getBoundingClientRect().bottom + CONST.GAP/2;
      }
      insertLine.hidden=false; insertLine.style.left=left+'px'; insertLine.style.width=width+'px'; insertLine.style.top=yGuide+'px';
    }

    return { headerCells, dayCells, stacks, getSnapCellAt, getCellIndex, layoutAll, layoutColumn, removeFromStack, assignToStack, setSnapHighlight, clearSnapHighlight, hideInsertLine, updateInsertLine };
  })();

  const Sidebar = {
    addTemplate(text, colorOverride){
      const el=document.createElement('div');
      el.className='bubble template';
      el.setAttribute('draggable','true');
      el.dataset.text=text;

      const color=colorOverride||U.randomAccent();
      el.dataset.color=color;
      el.style.setProperty('--bubble-fill', color);
      el.style.setProperty('--bubble-fg', U.bestTextForBg(color));

      const label=document.createElement('span');
      label.textContent=text; label.draggable=false;
      el.appendChild(label);

      el.addEventListener('mousedown',()=>{
        const sel=window.getSelection&&window.getSelection();
        if(sel && !sel.isCollapsed){ try{ sel.removeAllRanges(); }catch(_){} }
      });

      el.addEventListener('dragstart',(e)=>{
        const dt=e.dataTransfer; if(!dt) return;
        const rectT=el.getBoundingClientRect();
        dt.effectAllowed='copyMove';
        dt.setData('application/x-bubble-template','1');
        dt.setData('text/x-bubble-text', text);
        dt.setData('text/x-bubble-color', el.dataset.color||'');
        dt.setData('text/plain', text);
        state.currentDraggedTemplate=el;

        const ghost=el.cloneNode(true);
        Object.assign(ghost.style,{ position:'fixed', top:'-1000px', left:'-1000px', pointerEvents:'none', width:rectT.width+'px', height:rectT.height+'px'});
        document.body.appendChild(ghost); dt.setDragImage(ghost, rectT.width/2, rectT.height/2); el._dragGhost=ghost;

        els.trash.classList.add('visible'); e.stopPropagation();
      });

      el.addEventListener('dragend',()=>{
        els.trash.classList.remove('visible','over'); state.currentDraggedTemplate=null; if(el._dragGhost){ try{ el._dragGhost.remove(); }catch(_){} el._dragGhost=null; }
      });

      els.templates.appendChild(el); Store.save();
    }
  };

  const Modal = {
    open(){
      els.modal.hidden=false; els.input.value=''; requestAnimationFrame(()=>{ els.input && els.input.focus(); });
      Modal.renderPresets();
    },
    close(){ els.modal.hidden=true; },
    renderPresets(){
      if(!els.colorPresets) return; els.colorPresets.innerHTML='';
      PRESETS.forEach((hex,idx)=>{
        const btn=document.createElement('button');
        btn.type='button'; btn.className='swatch'; btn.style.background=hex; btn.setAttribute('aria-label',`Color ${hex}`); btn.dataset.color=hex;
        if(idx===0) btn.classList.add('selected');
        btn.addEventListener('click',()=>{ const prev=els.colorPresets.querySelector('.swatch.selected'); if(prev) prev.classList.remove('selected'); btn.classList.add('selected'); });
        els.colorPresets.appendChild(btn);
      });
    },
    selectedColor(){ const sel=els.colorPresets? els.colorPresets.querySelector('.swatch.selected'):null; return sel? sel.dataset.color : (PRESETS[0]||'#22d3ee'); },
    wire(){
      els.addBtn.addEventListener('click', Modal.open);
      els.cancelBtn.addEventListener('click', Modal.close);
      els.modal.addEventListener('click',(e)=>{ if(e.target===els.modal) Modal.close(); });
      window.addEventListener('keydown',(e)=>{ if(!els.modal.hidden && e.key==='Escape') Modal.close(); });
      els.form.addEventListener('submit',(e)=>{ e.preventDefault(); const text=els.input.value.trim(); if(!text) return; const color=Modal.selectedColor(); Sidebar.addTemplate(text,color); Modal.close(); });
    }
  };

  const Canvas = {
    createInstance(text, clientX, clientY, color){
      const el=document.createElement('div'); el.className='bubble instance'; el.style.position='absolute'; el.dataset.text=text;
      const fill=color||U.randomAccent(); el.style.setProperty('--stack-accent', fill); el.style.setProperty('--bubble-fill', fill); el.style.setProperty('--bubble-fg', U.bestTextForBg(fill));
      const label=document.createElement('span'); label.textContent=text; label.draggable=false; el.appendChild(label);
      els.canvas.appendChild(el);
      const rect=els.canvas.getBoundingClientRect(); const left=(clientX - rect.left) - el.offsetWidth/2; const top=(clientY - rect.top) - el.offsetHeight/2;
      Canvas.placeWithin(el, left, top); Canvas.makeDraggable(el);
      const snap=Week.getSnapCellAt(clientX, clientY); if(snap.inside && snap.cell){ Week.assignToStack(el, snap.cell, clientY); }
    },
    placeWithin(el,left,top){
      const maxLeft=Math.max(0, els.canvas.clientWidth - el.offsetWidth);
      const maxTop=Math.max(0, els.canvas.clientHeight - el.offsetHeight);
      el.style.left=U.clamp(left,0,maxLeft)+'px'; el.style.top=U.clamp(top,0,maxTop)+'px';
    },
    makeDraggable(el){
      el.addEventListener('dragstart',(e)=> e.preventDefault());
      el.addEventListener('pointerdown',(e)=>{
        const sel=window.getSelection&&window.getSelection(); if(sel && !sel.isCollapsed){ try{ sel.removeAllRanges(); }catch(_){} }
        e.preventDefault(); el.setPointerCapture(e.pointerId); el.classList.add('dragging');
        el.style.zIndex = String(++state.zCounter);
        els.trash.classList.add('visible');

        const pid=e.pointerId; let ended=false; let lastX=e.clientX, lastY=e.clientY;
        const wasStacked = el.dataset.stackCol !== undefined; let initialCell=null;
        if(wasStacked){ const col=parseInt(el.dataset.stackCol,10); initialCell = Week.dayCells[col] || null; if(initialCell) Week.setSnapHighlight(initialCell); }
        Week.removeFromStack(el); if(wasStacked && initialCell){ Week.updateInsertLine(initialCell, e.clientY); }

        let rect0=el.getBoundingClientRect(); let offsetX=e.clientX-rect0.left, offsetY=e.clientY-rect0.top;
        if(el.parentElement!==document.body){ document.body.appendChild(el); }
        el.style.position='fixed';
        { const rAfterMove=el.getBoundingClientRect(); offsetX=rAfterMove.width/2; offsetY=rAfterMove.height/2; }
        el.style.left=(e.clientX - offsetX)+'px'; el.style.top=(e.clientY - offsetY)+'px';

        const onMove=(ev)=>{
          if(ev.pointerId!==pid) return; const x=ev.clientX, y=ev.clientY; lastX=x; lastY=y;
          els.sidebar.classList.toggle('drop-target', U.overSidebarXY(x,y));
          els.trash.classList.toggle('over', U.overTrashXY(x,y));
          const {cell:hoverCell, inside} = Week.getSnapCellAt(x,y);
          Week.setSnapHighlight(inside? hoverCell : null);
          if(inside && hoverCell) Week.updateInsertLine(hoverCell,y); else Week.hideInsertLine();
          el.style.left=(x - offsetX)+'px'; el.style.top=(y - offsetY)+'px';
        };

        const onUp=(ev)=>{
          if(ended) return; ended=true; try{ if(ev && ev.pointerId!=null) el.releasePointerCapture(ev.pointerId);}catch(_){ }
          el.classList.remove('dragging'); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp); window.removeEventListener('blur', onUp); el.removeEventListener('lostpointercapture', onUp);
          els.sidebar.classList.remove('drop-target'); Week.clearSnapHighlight(); Week.hideInsertLine();
          const x=(ev && typeof ev.clientX==='number')? ev.clientX : lastX; const y=(ev && typeof ev.clientY==='number')? ev.clientY : lastY;
          el.style.left=(x - offsetX)+'px'; el.style.top=(y - offsetY)+'px';

          if(U.overTrashXY(x,y)) { el.remove(); els.trash.classList.remove('over','visible'); return; }
          if(U.overSidebarXY(x,y)) { el.remove(); els.trash.classList.remove('over','visible'); return; }

          const snap=Week.getSnapCellAt(x,y);
          if(snap.inside && snap.cell){ if(el.parentElement!==els.canvas){ els.canvas.appendChild(el); } el.style.position='absolute'; el.style.left=''; el.style.top=''; Week.assignToStack(el, snap.cell, y); el.style.zIndex=''; els.trash.classList.remove('over','visible'); return; }

          const crect=els.canvas.getBoundingClientRect(); if(el.parentElement!==els.canvas){ els.canvas.appendChild(el); }
          el.style.position='absolute'; Canvas.placeWithin(el, x - crect.left - offsetX, y - crect.top - offsetY); els.trash.classList.remove('over','visible');
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
        window.addEventListener('blur', onUp);
        el.addEventListener('lostpointercapture', onUp);
      });
    },
    wireDndFromSidebar(){
      els.canvas.addEventListener('dragover',(e)=>{
        const types=e.dataTransfer?.types||[]; const isBubbleDrag=!!state.currentDraggedTemplate || Array.from(types).includes('application/x-bubble-template');
        if(!isBubbleDrag) return; e.preventDefault(); e.dataTransfer.dropEffect='copy';
        const x=e.clientX, y=e.clientY; const {cell,inside}=Week.getSnapCellAt(x,y); Week.setSnapHighlight(inside? cell : null); if(inside && cell) Week.updateInsertLine(cell,y); else Week.hideInsertLine();
      });
      els.canvas.addEventListener('drop',(e)=>{
        const types=e.dataTransfer?.types||[]; const isBubbleDrag=!!state.currentDraggedTemplate || Array.from(types).includes('application/x-bubble-template');
        if(!isBubbleDrag) return; e.preventDefault();
        const text=e.dataTransfer.getData('text/x-bubble-text') || e.dataTransfer.getData('text/plain') || (state.currentDraggedTemplate?.dataset.text || '');
        const color=e.dataTransfer.getData('text/x-bubble-color') || (state.currentDraggedTemplate?.dataset.color || '');
        if(!text){ Week.clearSnapHighlight(); Week.hideInsertLine(); return; }
        Canvas.createInstance(text, e.clientX, e.clientY, color); Week.clearSnapHighlight(); Week.hideInsertLine();
      });
      els.canvas.addEventListener('dragleave', ()=>{ Week.clearSnapHighlight(); Week.hideInsertLine(); });
    }
  };

  const Trash = {
    wire(){
      els.trash.addEventListener('dragover',(e)=>{ if(state.currentDraggedTemplate){ e.preventDefault(); e.dataTransfer.dropEffect='move'; els.trash.classList.add('over'); }});
      els.trash.addEventListener('dragleave',()=>{ els.trash.classList.remove('over'); });
      els.trash.addEventListener('drop',(e)=>{ e.preventDefault(); if(state.currentDraggedTemplate){ state.currentDraggedTemplate.remove(); state.currentDraggedTemplate=null; Store.save(); } els.trash.classList.remove('over','visible'); });
    }
  };

  function init(){
    Modal.wire(); Canvas.wireDndFromSidebar(); Trash.wire(); Store.load();
    Week.layoutAll();
    window.addEventListener('resize',()=>{
      const instances=els.canvas.querySelectorAll('.bubble.instance');
      instances.forEach(el=>{ Canvas.placeWithin(el, parseFloat(el.style.left)||0, parseFloat(el.style.top)||0); });
      Week.layoutAll();
    });
  }

  init();
})();
