(function(){
  const svg = document.getElementById('plantSvg');
  const plantWrap = document.getElementById('plantWrap');
  const SECTIONS = 9; // hero + 6 leaves + 2 slots reserved for the underground/roots section

  // Scene metrics are recomputed on every (re)build so the artwork always fits
  // the current viewport. We keep the viewBox WIDTH at 1000 and set its HEIGHT to
  // match the element's aspect ratio (1000 * docHeight / width). That makes the
  // scale uniform in both axes — so the flower stays perfectly round AND nothing
  // is ever cropped off the bottom, even in fullscreen / very wide windows.
  let VB_H, SEC, baseY, groundCx;
  let stemTop, flowerCx, flowerCy, flowerScale;
  let leafDefs = [], leafYs = [];

  // Roots live in #rootLayer, an absolutely-positioned SVG that scrolls with the
  // page, so they're drawn in DOCUMENT-pixel coordinates and only need redrawing
  // when layout actually changes (carousel rotation, resize) — never on scroll.
  let storyCards = [];
  const rootLayer   = document.getElementById('rootLayer');
  const rootStruct  = document.getElementById('rootStruct');
  const rootCards   = document.getElementById('rootCards');
  const aboutCard   = document.querySelector('.about-card');
  const mediaCard = document.querySelector('.media-card');
  // absolute document position/size of an element (unaffected by current scroll)
  function docPos(el){
    const r = el.getBoundingClientRect();
    return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height,
             cx: r.left + window.scrollX + r.width/2, cy: r.top + window.scrollY + r.height/2 };
  }

  function stemX(y){ return 500 + 70 * Math.sin((y - 0.26*SEC) / (0.9*SEC)); }
  function groundY(x){ return baseY + 6 * Math.sin(x / 70); }

  function buildStemPath(fromY, toY){
    let d = '';
    for (let y = fromY; y <= toY; y += Math.max(8, SEC/50)){
      const x = stemX(y);
      d += (d === '' ? `M ${x} ${y} ` : `L ${x} ${y} `);
    }
    return d;
  }

  function clearGroup(id){
    const g = document.getElementById(id);
    while (g.firstChild) g.removeChild(g.firstChild);
    return g;
  }

  // set physical height of the plant wrap to match total document height
  function syncHeight(){
    plantWrap.style.height = document.body.scrollHeight + 'px';
  }

  function buildScene(){
    // measure the document without the (absolutely-positioned) overlays skewing it
    plantWrap.style.height = '0px';
    if (rootLayer) rootLayer.setAttribute('height', 0);
    const W = plantWrap.clientWidth || window.innerWidth;
    const docH = document.body.scrollHeight;

    VB_H = 1000 * docH / Math.max(1, W); // aspect-matched height
    SEC = VB_H / SECTIONS;
    svg.setAttribute('viewBox', `0 0 1000 ${VB_H}`);

    // Anchor the plant to the REAL positions of the HTML sections rather than to
    // fixed 1/9 slots. The underground (roots) section's content varies a lot with
    // viewport — especially on phones where the cards stack tall — so a fixed
    // ground height would leave the carousel floating above the surface. Converting
    // document pixels to viewBox units keeps everything aligned everywhere.
    const yOf = px => (px / docH) * VB_H;
    const projSections = document.querySelectorAll('.project-section');
    leafYs = [];
    projSections.forEach(sec=>{
      const r = sec.getBoundingClientRect();
      leafYs.push(yOf(r.top + window.scrollY + r.height * 0.4)); // upper portion of each section
    });
    const rootsSection = document.querySelector('.roots-section');
    const groundPx = rootsSection
      ? (rootsSection.getBoundingClientRect().top + window.scrollY)
      : docH * (7/9);
    baseY = yOf(groundPx);   // ground = top of the underground section (the surface)
    groundCx = stemX(baseY);

    // Anchor the flower a FIXED distance from the top edge. The petals extend 210
    // units above the centre and shapes are drawn at a fixed size, so a proportional
    // (SEC-based) offset would drop below 210 on wide/fullscreen viewports and clip
    // the top petals.
    // The flower is drawn at a fixed unit size but the whole scene scales with
    // width: on wide viewports the petals balloon, so the size is capped; on
    // PHONES the same flower renders tiny and huddles at the very top, so below
    // 720px it's scaled UP instead (to 1.6x on the narrowest screens) and its
    // centre drops to ~30% of the viewport height, filling the hero properly.
    if (W < 720){
      flowerScale = Math.min(1.6, 720 / Math.max(1, W));
      flowerCy = Math.max(
        60 + 210 * flowerScale,                 // never clip the top petals
        0.30 * window.innerHeight * 1000 / W    // sit ~30% down the first screen
      );
    } else {
      flowerScale = Math.min(1, 1190 / Math.max(1, W));
      flowerCy = 270;
    }
    stemTop  = flowerCy + 40;      // stem emerges from just inside the flower disc
    flowerCx = stemX(stemTop);

    // stem thickness: 14 units reads right on desktop, but units shrink with the
    // screen (1 unit = W/1000 px), so on phones 14 units is a ~5px thread —
    // widen it there so the stem holds its visual weight (~10px)
    document.getElementById('stemPath').setAttribute('stroke-width', W < 720 ? 26 : 14);

    document.getElementById('stemPath').setAttribute('d', buildStemPath(stemTop, baseY + 20));
    buildFlower();
    buildLeaves();
    buildGround();
    buildRoots();

    plantWrap.style.height = docH + 'px';

    // size the document-space root layer to cover the whole page (1 unit = 1px),
    // then (re)draw the roots for the new layout. Structure roots are static;
    // card roots also refresh here because the carousel moved with the reflow.
    if (rootLayer){
      rootLayer.setAttribute('width', W);
      rootLayer.setAttribute('height', docH);
      drawStructureRoots();
      drawCardRoots();
    }
  }

  // ---------- flower head ----------
  function buildFlower(){
    const g = clearGroup('flowerGroup');
    const cy = flowerCy, cx = flowerCx;
    // keep the flower's size in check on wide viewports, scaling about its centre
    g.setAttribute('transform', `translate(${cx} ${cy}) scale(${flowerScale}) translate(${-cx} ${-cy})`);
    const petalCount = 18, len = 210, width = 90;
    for (let i = 0; i < petalCount; i++){
      const angle = (360 / petalCount) * i;
      const p = document.createElementNS('http://www.w3.org/2000/svg','path');
      p.setAttribute('d', `M ${-width/2} 0 Q ${-width/2} ${-len*0.62} 0 ${-len} Q ${width/2} ${-len*0.62} ${width/2} 0 Q 0 ${width*0.18} ${-width/2} 0 Z`);
      p.setAttribute('fill', 'url(#petalGrad)');
      p.setAttribute('transform', `translate(${cx} ${cy}) rotate(${angle})`);
      p.setAttribute('opacity', '0.96');
      g.appendChild(p);
    }
    const center = document.createElementNS('http://www.w3.org/2000/svg','circle');
    center.setAttribute('cx', cx); center.setAttribute('cy', cy); center.setAttribute('r', 92);
    center.setAttribute('fill', 'url(#flowerCenter)');
    g.appendChild(center);
    // seed speckle texture — phyllotaxis spiral, packed densely so dots tile the entire disc edge-to-edge
    const R = 84, N = 620, dotR = 5.6, goldenAngle = 137.50776 * Math.PI/180;
    for (let i = 0; i < N; i++){
      const r = R * Math.sqrt(i / N);
      const a = i * goldenAngle;
      const sx = cx + r*Math.cos(a), sy = cy + r*Math.sin(a);
      const dot = document.createElementNS('http://www.w3.org/2000/svg','circle');
      dot.setAttribute('cx', sx); dot.setAttribute('cy', sy); dot.setAttribute('r', dotR);
      const shade = 0.5 + 0.5 * (r / R); // slightly darker near the rim for depth
      dot.setAttribute('fill', i % 5 === 0 ? '#2E1A0C' : '#4A2C16');
      dot.setAttribute('opacity', (0.6 + 0.35*shade).toFixed(2));
      g.appendChild(dot);
    }
  }

  // ---------- leaves ----------
  function buildLeaves(){
    const leavesGroup = clearGroup('leavesGroup');
    leafDefs = [];
    for (let i = 0; i < 6; i++){
      const y = (leafYs[i] != null) ? leafYs[i] : (1.38 + i) * SEC; // anchored to project section i
      const side = (i % 2 === 0) ? 1 : -1; // alternate right(1)/left(-1)
      const x = stemX(y);
      const g = document.createElementNS('http://www.w3.org/2000/svg','g');
      g.classList.add('leaf-group');
      g.setAttribute('data-index', i);
      g.setAttribute('transform', `translate(${x} ${y}) scale(${side},1) rotate(-58)`);

      const leaf = document.createElementNS('http://www.w3.org/2000/svg','path');
      const L = 260, W = 140;
      leaf.setAttribute('class','leaf-shape');
      leaf.setAttribute('d', `M0,0 Q ${L*0.35},${-W*0.55} ${L},0 Q ${L*0.35},${W*0.55} 0,0 Z`);
      leaf.setAttribute('fill', 'url(#leafGrad)');
      g.appendChild(leaf);

      const vein = document.createElementNS('http://www.w3.org/2000/svg','path');
      vein.setAttribute('d', `M6,0 L ${L-10},0`);
      vein.setAttribute('stroke', 'rgba(255,255,255,0.35)');
      vein.setAttribute('stroke-width','2.4');
      g.appendChild(vein);

      // invisible marker at the leaf tip — read to place the project card
      const tip = document.createElementNS('http://www.w3.org/2000/svg','circle');
      tip.setAttribute('cx', L - 16); tip.setAttribute('cy', 0); tip.setAttribute('r', 2);
      tip.setAttribute('fill', 'transparent');
      tip.setAttribute('id', `leaf-tip-${i}`);
      g.appendChild(tip);

      leavesGroup.appendChild(g);
      leafDefs.push({ el: g, tip, x, y, side, restRotate: -58, activeRotate: 0 });
    }
  }

  // ---------- grass + hill boundary ----------
  // groundY(x) is the single source of truth for where "ground level" sits at
  // any horizontal position — the hill fill, the grass blades, the stem's
  // endpoint, and the roots' starting point all reference this same line.
  function buildGround(){
    const g = clearGroup('groundGroup');

    // the hill itself: a filled shape whose top edge IS groundY(x). It spans well
    // beyond the 0–1000 viewBox so it always reaches the window edges regardless
    // of aspect ratio, and fills all the way to the bottom of the document.
    const HX0 = -400, HX1 = 1400;
    const hill = document.createElementNS('http://www.w3.org/2000/svg','path');
    let d = `M ${HX0} ${groundY(HX0)} `;
    for (let x = HX0; x <= HX1; x += 20){ d += `L ${x} ${groundY(x)} `; }
    d += `L ${HX1} ${VB_H} L ${HX0} ${VB_H} Z`;
    hill.setAttribute('d', d);
    hill.setAttribute('fill', 'url(#hillGrad)');
    g.appendChild(hill);

    // grass blades — stratified across the full width so there are no bare
    // patches, with jitter and varied height/lean for a natural, dense look.
    // Thin the count out on small screens to keep phones smooth.
    const dense = (window.innerWidth < 720) ? 0.4 : 1;
    const bladeCount = Math.round(640 * dense), minX = HX0, maxX = HX1, slot = (maxX - minX) / bladeCount;
    for (let i = 0; i < bladeCount; i++){
      const bx = minX + slot * i + (Math.random() - 0.5) * slot * 1.6;
      const distFromCenter = Math.abs(bx - groundCx);
      const density = 1 - Math.min(1, distFromCenter / 620);
      const h = 22 + Math.random() * 42 * (0.55 + density * 0.45);
      const lean = (Math.random() - 0.5) * 24;
      const by = groundY(bx) + 1; // sit right on the hill edge, slightly overlapping to hide the seam
      const blade = document.createElementNS('http://www.w3.org/2000/svg','path');
      blade.setAttribute('d', `M ${bx} ${by} Q ${bx + lean*0.6} ${by - h*0.6} ${bx + lean} ${by - h}`);
      blade.setAttribute('stroke', i % 2 === 0 ? '#6E8C4E' : '#4F6B37');
      blade.setAttribute('stroke-width', (2.2 + Math.random()*1.2).toFixed(1));
      blade.setAttribute('fill', 'none');
      blade.setAttribute('opacity', (0.62 + Math.random()*0.32).toFixed(2));
      blade.classList.add('grass-blade');
      blade.style.animationDelay = (Math.random() * 4).toFixed(2) + 's';
      g.appendChild(blade);
    }

    // a second, shorter layer packed in front to further close any remaining gaps
    for (let i = 0, n = Math.round(190 * dense); i < n; i++){
      const bx = minX + Math.random() * (maxX - minX);
      const h = 12 + Math.random() * 20;
      const lean = (Math.random() - 0.5) * 16;
      const by = groundY(bx) + 2;
      const blade = document.createElementNS('http://www.w3.org/2000/svg','path');
      blade.setAttribute('d', `M ${bx} ${by} Q ${bx + lean*0.6} ${by - h*0.6} ${bx + lean} ${by - h}`);
      blade.setAttribute('stroke', i % 2 === 0 ? '#5C7A3B' : '#7FA05A');
      blade.setAttribute('stroke-width', 2);
      blade.setAttribute('fill', 'none');
      blade.setAttribute('opacity', (0.5 + Math.random()*0.3).toFixed(2));
      blade.classList.add('grass-blade');
      blade.style.animationDelay = (Math.random() * 4).toFixed(2) + 's';
      g.appendChild(blade);
    }
  }

  // ---------- roots ----------
  function buildRoots(){
    const g = clearGroup('rootsGroup');
    const cx = groundCx;
    // the convergence point sits exactly on the hill surface at the foot of the
    // stem (groundY includes the hill's gentle wobble), so every root meets the
    // stem right where it enters the ground
    const surfaceY = groundY(cx) + 5;

    // convergence marker: the exact point where the stem meets the hill and all
    // the roots converge. The root layer reads this element's live position.
    const conv = document.createElementNS('http://www.w3.org/2000/svg','circle');
    conv.setAttribute('cx', cx); conv.setAttribute('cy', surfaceY);
    conv.setAttribute('r', 1.5); conv.setAttribute('fill', 'transparent');
    conv.setAttribute('id', 'stem-base-tip');
    g.appendChild(conv);

    // short decorative roots fanning out just beneath the hill, so the
    // convergence point sits in a small nest of soil roots
    const startY = surfaceY + 12; // a touch below the surface for the little soil roots
    const branches = [
      [-150, 150, -30],[150, 170, 40],[-80, 240, -50],
      [90, 250, 50],[0, 290, 0],[-230, 90,-8],[230,100,10]
    ];
    branches.forEach(([dx, dy, curve])=>{
      const path = document.createElementNS('http://www.w3.org/2000/svg','path');
      path.setAttribute('d', `M ${cx} ${startY} Q ${cx+curve} ${startY+dy*0.6} ${cx+dx} ${startY+dy}`);
      path.setAttribute('stroke-width', 6);
      path.setAttribute('opacity', 0.85);
      g.appendChild(path);
    });
  }

  // build the whole scene once up front (also re-run on resize / fullscreen)
  buildScene();

  // ---------- clouds ----------
  (function makeClouds(){
    const layer = document.getElementById('cloudLayer');
    if (!layer) return;
    const count = window.innerWidth < 720 ? 4 : 7;
    for (let i = 0; i < count; i++){
      const c = document.createElement('div');
      c.className = 'cloud';
      const s = 0.6 + Math.random() * 1.0;           // size variety
      c.style.setProperty('--s', s.toFixed(2));
      c.style.top = (4 + Math.random() * 48) + '%';   // sit in the upper sky
      const dur = 55 + Math.random() * 55;            // slow drift
      c.style.animationDuration = dur.toFixed(1) + 's';
      c.style.animationDelay = (-Math.random() * dur).toFixed(1) + 's'; // pre-spread across the sky
      c.style.opacity = (0.72 + Math.random() * 0.22).toFixed(2);
      layer.appendChild(c);
    }
  })();

  // ---------- scroll-driven color + leaf/holo state ----------
  // blue day sky up top, hazing toward the horizon, then into soil underground
  const stops = [
    {f:0,    top:[86,161,222],  bot:[164,206,235]},
    {f:0.42, top:[120,182,226], bot:[190,216,234]},
    {f:0.72, top:[196,216,228], bot:[206,196,168]},
    {f:1,    top:[62,42,26],    bot:[36,20,8]}
  ];
  function lerp(a,b,t){ return a+(b-a)*t; }
  function colorAt(frac, key){
    for (let i=0;i<stops.length-1;i++){
      if (frac >= stops[i].f && frac <= stops[i+1].f){
        const t = (frac - stops[i].f)/(stops[i+1].f - stops[i].f);
        const c0 = stops[i][key], c1 = stops[i+1][key];
        return [lerp(c0[0],c1[0],t), lerp(c0[1],c1[1],t), lerp(c0[2],c1[2],t)];
      }
    }
    return stops[stops.length-1][key];
  }
  const rgb = a => `rgb(${a[0]|0},${a[1]|0},${a[2]|0})`;

  const projectSections = Array.from(document.querySelectorAll('.project-section'));
  const holoAnchors = Array.from(document.querySelectorAll('.holo-anchor'));
  const skyLayer = document.getElementById('skyLayer');
  const sun = document.getElementById('sun');
  const cloudLayer = document.getElementById('cloudLayer');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const smooth = t => t*t*(3 - 2*t); // smoothstep easing

  function onScroll(){
    const docH = document.body.scrollHeight - window.innerHeight;
    const frac = Math.min(1, Math.max(0, window.scrollY / docH));

    skyLayer.style.background = `linear-gradient(180deg, ${rgb(colorAt(frac,'top'))}, ${rgb(colorAt(frac,'bot'))})`;
    sun.style.transform = `translateY(${frac*70}vh)`;
    sun.style.opacity = Math.max(0, 1 - frac*1.6);
    if (cloudLayer) cloudLayer.style.opacity = Math.max(0, 1 - frac*1.6); // clouds fade as we head underground

    const H = window.innerHeight;
    const ctm = svg.getScreenCTM();
    const pt = svg.createSVGPoint();
    // A leaf starts folded the instant its base crosses the bottom edge and is
    // fully open a bit below the middle of the screen — so it opens early and the
    // project card can appear sooner.
    const enterY = H * 0.98, flatY = H * 0.55;

    projectSections.forEach((sec, i)=>{
      const leaf = leafDefs[i];
      const side = leaf.side;

      // rotation-independent screen position of the leaf's base (its pivot),
      // read via the SVG's transform matrix so it isn't skewed by the current rotation
      let baseScreenY = H; // default off-screen-bottom (folded) if metrics unavailable
      if (ctm){
        pt.x = leaf.x; pt.y = leaf.y;
        baseScreenY = pt.matrixTransform(ctm).y;
      }

      // unfurl progress: 0 = folded (just entering / off-screen), 1 = flat (open)
      let p;
      if (reduceMotion){
        p = (baseScreenY < H && baseScreenY > 0) ? 1 : 0; // no scroll-linked motion
      } else {
        p = smooth(Math.max(0, Math.min(1, (enterY - baseScreenY) / (enterY - flatY))));
      }

      const rotate = leaf.restRotate * (1 - p);
      leaf.el.setAttribute('transform', `translate(${leaf.x} ${leaf.y}) scale(${side},1) rotate(${rotate})`);

      // reveal the project card when its (now-open) leaf is around the middle of
      // the screen — biased slightly low so the card appears earlier — while still
      // showing one card at a time even though every visible leaf is unfurling
      // hysteresis: a wider band to switch OFF than ON, so slow scrolling (and
      // mobile URL-bar height changes) hovering near the boundary can't rapidly
      // re-trigger the fade transition — the source of the glitchy flicker
      const dist = Math.abs(baseScreenY - H*0.46);
      const wasActive = sec.classList.contains('active');
      const activeNow = wasActive
        ? (dist < H*0.34 && p > 0.30)   // once shown, keep until clearly out
        : (dist < H*0.26 && p > 0.45);  // stricter test to appear
      sec.classList.toggle('active', activeNow);

      // place the card directly above the leaf's live tip, so it rises with the leaf
      const tipRect = leaf.tip.getBoundingClientRect();
      const anchor = holoAnchors[i];
      const margin = Math.min(180, window.innerWidth * 0.44); // keep the card on-screen on phones
      const minX = margin, maxX = window.innerWidth - margin;
      const x = Math.min(maxX, Math.max(minX, tipRect.left + tipRect.width/2));
      anchor.style.left = x + 'px';
      anchor.style.top  = (tipRect.top + tipRect.height/2) + 'px';
    });
  }

  // ---------- card roots (carousel cards → stem base), in document coordinates ----------
  // Redrawn only when the carousel rotates (and on resize) — never on scroll, since
  // in document space the roots scroll naturally with the page.
  function drawCardRoots(){
    const stemBase = document.getElementById('stem-base-tip');
    if (!stemBase || !storyCards.length) return;
    const b = docPos(stemBase);
    const cx = b.cx, cy = b.cy; // convergence point on the hill surface (document px)

    while (rootCards.children.length < storyCards.length){
      rootCards.appendChild(document.createElementNS('http://www.w3.org/2000/svg','path'));
    }

    storyCards.forEach((card, i)=>{
      const p = docPos(card);
      const tx = p.cx, ty = p.y; // top-centre of the card (its top edge)
      const path = rootCards.children[i];

      // organic snake: two control points nudged sideways by a per-card phase so
      // the roots weave rather than run straight, all fanning from one origin
      const dy = ty - cy;
      const phase = (i - (storyCards.length - 1) / 2);
      const wob = 26;
      const c1x = cx + phase * 10 + Math.sin(i * 1.3) * wob;
      const c1y = cy + dy * 0.34;
      const c2x = tx - phase * 6 - Math.sin(i * 2.1) * wob;
      const c2y = cy + dy * 0.72;
      path.setAttribute('d', `M ${cx} ${cy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${tx} ${ty}`);

      const active = card.classList.contains('is-active');
      path.setAttribute('stroke-width', active ? 2.4 : 1.6);
      path.setAttribute('opacity', active ? 0.9 : 0.5);
    });
  }

  // ---------- structural roots (static, in document coordinates) ----------
  // 1) a root from the stem base down to the top of the About Me card, passing
  //    behind the carousel; 2) & 3) curved roots down the left and right sides from
  //    the About Me card to the Spotify card; plus the convergence dot on the hill.
  function ensureStructNodes(){
    while (rootStruct.querySelectorAll('path').length < 3){
      rootStruct.insertBefore(document.createElementNS('http://www.w3.org/2000/svg','path'), rootStruct.firstChild);
    }
    if (!rootStruct.querySelector('.conv-dot')){
      const dot = document.createElementNS('http://www.w3.org/2000/svg','circle');
      dot.setAttribute('class', 'conv-dot'); dot.setAttribute('r', 5);
      rootStruct.appendChild(dot);
    }
  }
  function drawStructureRoots(){
    const stemBase = document.getElementById('stem-base-tip');
    if (!stemBase || !aboutCard || !mediaCard) return;
    ensureStructNodes();
    const b = docPos(stemBase);
    const cx = b.cx, cy = b.cy;
    const a = docPos(aboutCard);
    const s = docPos(mediaCard);
    const paths = rootStruct.querySelectorAll('path');

    // 1) stem base → top-centre of the About Me card, gently weaving as it descends
    const aTop = a.y, aCx = a.cx;
    let d1 = `M ${cx} ${cy} `;
    const steps = 12;
    for (let i = 1; i <= steps; i++){
      const t = i / steps;
      const y = cy + (aTop - cy) * t;
      const x = cx + (aCx - cx) * t + Math.sin(t * Math.PI * 2.2) * 13 * Math.sin(t * Math.PI);
      d1 += `L ${x} ${y} `;
    }
    paths[0].setAttribute('d', d1);

    // 2) & 3) side roots: from the About Me card's sides, bowing outward, down to
    //    the Spotify card's sides
    const bulge = 66;
    const aY = a.y + a.h * 0.62, sY = s.y + s.h * 0.4;
    const aL = a.x, aR = a.x + a.w, sL = s.x, sR = s.x + s.w;
    const midHi = aY + (sY - aY) * 0.33, midLo = aY + (sY - aY) * 0.66;
    paths[1].setAttribute('d', `M ${aL} ${aY} C ${aL - bulge} ${midHi}, ${sL - bulge} ${midLo}, ${sL} ${sY}`);
    paths[2].setAttribute('d', `M ${aR} ${aY} C ${aR + bulge} ${midHi}, ${sR + bulge} ${midLo}, ${sR} ${sY}`);

    for (const p of paths){ p.setAttribute('stroke-width', 2); p.setAttribute('opacity', 0.55); }

    const dot = rootStruct.querySelector('.conv-dot');
    if (dot){ dot.setAttribute('cx', cx); dot.setAttribute('cy', cy); }
  }

  // Rebuild the scene whenever the viewport or document size changes (resize,
  // fullscreen toggles, late font/layout shifts). Rebuilds are debounced so a
  // burst of events — e.g. a phone's address bar sliding in/out during scroll —
  // collapses into a single rebuild once things settle, rather than firing on
  // every intermediate frame. The rebuild itself is synchronous, so there's no
  // visible flash.
  let needsRebuild = false, rebuildTimer = null;
  let lastRebuildW = window.innerWidth;
  const coarseTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  function requestRebuild(delay, force){
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(()=>{
      // On phones the URL bar sliding in/out fires resizes where only the HEIGHT
      // changes; rebuilding then makes the whole plant visibly jump mid-scroll.
      // Width is what the artwork actually scales by, so height-only changes are
      // ignored on touch devices (orientation/fullscreen pass force=true).
      const w = window.innerWidth;
      if (!force && coarseTouch && w === lastRebuildW) return;
      lastRebuildW = w;
      needsRebuild = true;
    }, delay == null ? 180 : delay);
  }
  window.addEventListener('resize', ()=> requestRebuild());
  window.addEventListener('orientationchange', ()=> requestRebuild(120, true));
  document.addEventListener('fullscreenchange', ()=> requestRebuild(120, true));
  if (window.ResizeObserver){
    let firstRO = true;
    new ResizeObserver(()=>{ if (firstRO){ firstRO = false; return; } requestRebuild(); })
      .observe(document.body);
  }

  // A continuous animation-frame loop keeps the holograms and root connectors
  // pinned to their live positions every frame — regardless of scroll direction,
  // momentum, or in-progress leaf/card transitions — so nothing blinks out.
  function frame(){
    if (needsRebuild){ needsRebuild = false; buildScene(); }
    onScroll();
    requestAnimationFrame(frame);
  }
  syncHeight();
  requestAnimationFrame(frame);

  // ---------- About Me: render the 3-dot skill scales from each row's data-level ----------
  (function renderSkillDots(){
    document.querySelectorAll('.skill').forEach(skill=>{
      const level = Math.max(0, Math.min(3, parseInt(skill.dataset.level || '0', 10)));
      const dots = document.createElement('span');
      dots.className = 'dots';
      dots.setAttribute('aria-label', level + ' out of 3');
      for (let i = 0; i < 3; i++){
        const d = document.createElement('span');
        d.className = 'dot' + (i < level ? ' filled' : '');
        dots.appendChild(d);
      }
      skill.appendChild(dots);
    });
  })();

  // ---------- story carousel: circular coverflow, every card stays visible ----------
  (function initStoryCarousel(){
    const viewport = document.getElementById('storyTrack');
    const cards = Array.from(viewport.querySelectorAll('.story-card'));
    const dots = Array.from(document.querySelectorAll('#storyDots button'));
    const count = cards.length;
    const angleStep = 34, radius = 470; // degrees between cards, and the arc's radius
    let current = 0;
    storyCards = cards; // expose to the root-connector routine

    // `offset` is the live rotational position in card-units; usually equals
    // `current`, but during a drag it moves continuously for smooth multi-card sweeps
    function layout(offset){
      const activeIdx = ((Math.round(offset) % count) + count) % count;
      cards.forEach((el, i) => {
        let diff = i - offset;
        // wrap into [-count/2, count/2] for shortest-path placement
        while (diff > count / 2) diff -= count;
        while (diff < -count / 2) diff += count;
        const abs = Math.abs(diff);
        const angleDeg = diff * angleStep;
        const rad = angleDeg * Math.PI / 180;
        const tx = Math.sin(rad) * radius;
        const tz = (Math.cos(rad) - 1) * radius;   // recedes as it curves away
        const scale = Math.max(0.6, 1 - abs * 0.08);
        const opacity = abs < 0.5 ? 1 : Math.max(0.4, 0.9 - (abs - 0.5) * 0.28);
        // +angleDeg makes each card's face turn OUTWARD along the arc
        el.style.transform =
          `translateX(${tx.toFixed(1)}px) translateZ(${tz.toFixed(1)}px) rotateY(${angleDeg.toFixed(1)}deg) scale(${scale.toFixed(3)})`;
        el.style.opacity = opacity.toFixed(2);
        el.style.zIndex = String(100 - Math.round(abs * 10));
        el.classList.toggle('is-active', i === activeIdx);
      });
      dots.forEach((d, i) => d.classList.toggle('active', i === activeIdx));
      drawCardRoots();
    }
    function render(){ layout(current); settleConnectors(); }
    function go(step){ current = (current + step + count) % count; render(); }

    // redraw the root connections continuously for the length of the card
    // transition, so the roots follow each card as it animates into focus rather
    // than snapping to stale positions the instant a new card takes centre
    let settleId = null;
    function settleConnectors(){
      if (settleId) cancelAnimationFrame(settleId);
      const start = performance.now(), dur = 700; // just over the 0.6s card transition
      (function tick(now){
        drawCardRoots();
        if (now - start < dur){ settleId = requestAnimationFrame(tick); }
        else { settleId = null; }
      })(start);
    }

    document.getElementById('storyNext').addEventListener('click', ()=>go(1));
    document.getElementById('storyPrev').addEventListener('click', ()=>go(-1));
    dots.forEach((d, i)=> d.addEventListener('click', ()=>{ current = i; render(); }));
    cards.forEach((el, i)=> el.addEventListener('click', ()=>{
      if (!didDrag && i !== current){ current = i; render(); }
    }));

    // continuous drag — the whole ring follows the pointer, so one long swipe can
    // sweep across several cards before snapping to the nearest on release
    let startX = 0, startY = 0, dragging = false, didDrag = false, axis = null, liveOffset = current, pid = null;
    const pxPerCard = 130; // horizontal pixels of drag equal to one card step

    viewport.addEventListener('pointerdown', (e)=>{
      dragging = true; didDrag = false; axis = null; pid = e.pointerId;
      startX = e.clientX; startY = e.clientY; liveOffset = current;
      // For a mouse we can lock to horizontal immediately; for touch we wait to see
      // whether the gesture is horizontal (rotate) or vertical (let the page scroll).
      if (e.pointerType === 'mouse'){
        axis = 'x';
        viewport.classList.add('is-dragging');
        try { viewport.setPointerCapture(e.pointerId); } catch(_){}
      }
    });
    viewport.addEventListener('pointermove', (e)=>{
      if (!dragging) return;
      const dx = e.clientX - startX, dy = e.clientY - startY;
      if (axis === null){
        // decide direction once the finger has moved enough
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if (Math.abs(dy) > Math.abs(dx)){ dragging = false; return; } // vertical → page scrolls
        axis = 'x';
        viewport.classList.add('is-dragging');
        try { viewport.setPointerCapture(pid); } catch(_){}
      }
      if (axis !== 'x') return;
      if (e.cancelable) e.preventDefault(); // now that we own the horizontal gesture
      if (Math.abs(dx) > 4) didDrag = true;
      liveOffset = current - dx / pxPerCard; // drag right → earlier cards
      layout(liveOffset);
    }, { passive:false });
    function endDrag(){
      if (!dragging && axis !== 'x') { viewport.classList.remove('is-dragging'); return; }
      dragging = false; axis = null;
      viewport.classList.remove('is-dragging');
      current = ((Math.round(liveOffset) % count) + count) % count;
      render();
    }
    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);
    viewport.addEventListener('pointerleave', endDrag);

    render();
  })();
 
  // ---------- spotify stats: updates stats on page from json ----------
  var SOURCE = "spotSection/spotDetails.json";
 
  // "top_artist.name" -> value, tolerating missing branches
  function pick(obj, path) {
    return path.split(".").reduce(function (acc, key) {
      return acc == null ? null : acc[key];
    }, obj);
  }
 
  function apply(stats) {
    document.querySelectorAll("[data-spotify]").forEach(function (el) {
      var value = pick(stats, el.getAttribute("data-spotify"));
      if (value) el.textContent = value;
    });
 
    document.querySelectorAll("[data-spotify-img]").forEach(function (el) {
      var url = pick(stats, el.getAttribute("data-spotify-img"));
      if (!url) return;
      el.style.backgroundImage = "url('" + url + "')";
      el.style.backgroundSize = "cover";
      el.style.backgroundPosition = "center";
    });
 
    // wrap items in their Spotify links, where the markup asks for it
    document.querySelectorAll("[data-spotify-url]").forEach(function (el) {
      var url = pick(stats, el.getAttribute("data-spotify-url"));
      if (url) {
        el.setAttribute("href", url);
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener");
      }
    });
 
    if (stats.period_label) {
      document.querySelectorAll("[data-spotify-period]").forEach(function (el) {
        el.textContent = "Spotify \u00b7 " + stats.period_label;
      });
    }
  }
 
  fetch(SOURCE, { cache: "no-cache" })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(apply)
    .catch(function (err) {
      // leave the placeholder content in place - just note why it didn't update
      console.warn("Spotify stats unavailable:", err.message);
    });
})();
