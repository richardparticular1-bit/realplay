(() => {
  const el = id => document.getElementById(id);
  const canvas=el('juggleCanvas'), ctx=canvas.getContext('2d');
  const counter=new JuggleCounter(), rankKey='realplay_juggle_ranking_v1';
  let worker=null, ready=false, active=false, busy=false, session=0, internalSeek=false;
  let source=null, floor=null, marking=false, raf=0, loadTimer=null;
  let lastFrame=-1, lastStamp=0, previousResult=0, savedAttempt=false;
  const status=text=>{el('juggleStatus').textContent=text;};
  function metrics(){
    el('juggleTotal').textContent=counter.total;
    el('juggleStreak').textContent=counter.streak;
    el('juggleBest').textContent=counter.best;
  }
  function controls(){
    el('startJuggle').disabled=active;
    el('stopJuggle').disabled=!active;
    el('juggleSource').disabled=active;
    el('calibrateFloor').disabled=canvas.hidden;
    el('saveJuggle').disabled=active;
  }
  function stop(text='Contagem pausada. Os resultados foram mantidos.'){
    active=false; session++; cancelAnimationFrame(raf);counter.clearTrack();
    controls(); status(text);
  }
  function fail(text){
    stop(text); clearTimeout(loadTimer); worker?.terminate();
    worker=null;ready=false;busy=false;
  }
  function reset(){
    counter.reset();savedAttempt=false;lastFrame=-1;previousResult=0;metrics();
  }
  function draw(balls=[],feet=[]){
    const w=canvas.width,h=canvas.height;
    if(floor!==null){ctx.strokeStyle='#ffd763';ctx.lineWidth=2;ctx.setLineDash([8,6]);ctx.beginPath();ctx.moveTo(0,floor*h);ctx.lineTo(w,floor*h);ctx.stroke();ctx.setLineDash([]);}
    for(const f of feet.filter(f=>f.visibility>=0.6)){
      ctx.fillStyle='#56e7ff';ctx.beginPath();ctx.arc(f.x*w,f.y*h,5,0,2*Math.PI);ctx.fill();
    }
    for(const b of balls){
      ctx.strokeStyle='#70ffac';ctx.lineWidth=3;ctx.beginPath();ctx.arc(b.x*w,b.y*h,b.r*h,0,2*Math.PI);ctx.stroke();
    }
    ctx.fillStyle='#06131ddd';ctx.fillRect(6,6,220,34);ctx.fillStyle='#70ffac';ctx.font='bold 20px system-ui';ctx.fillText(counter.total+' embaixadinhas',14,30);
  }
  function onResult(data){
    busy=false;
    if(!active || data.session!==session)return;
    const {balls,feet,mediaTime,t}=data;
    const fps=previousResult ? 1000/(t-previousResult) : 0;previousResult=t;
    const visibleFeet=feet.filter(f=>f.visibility>=0.6);
    let message;
    if(balls.length!==1){counter.missing(mediaTime*1000);message=balls.length ? 'Há mais de uma bola. Deixe apenas uma no quadro.' : 'Procurando a bola. Aproxime o aparelho e melhore a iluminação.';}
    else if(!visibleFeet.length){counter.missing(mediaTime*1000);message='Pés não visíveis. Enquadre o corpo inteiro e os pés.';}
    else if(floor===null){message='Marque a linha do chão no quadro para liberar a contagem.';}
    else {
      const hit=counter.sample({...balls[0],feet,t:mediaTime*1000},floor,canvas.width/canvas.height);
      if(hit){savedAttempt=false;hit.videoTime=mediaTime;canvas.style.outline='3px solid #70ffac';setTimeout(()=>canvas.style.outline='',180);}
      message=marking ? 'Toque no chão, logo abaixo dos pés, no quadro de análise.' : 'Contando automaticamente. Mantenha a bola e os pés visíveis.';
    }
    metrics();draw(balls,feet);status(message);
    el('juggleQuality').textContent=(balls.length===1 ? 'Detecção da bola: '+Math.round(balls[0].confidence*100)+'% • ' : '')+
      (fps ? Math.round(fps)+' quadros analisados/s'+(fps<8 ? ' • Processamento lento: lances rápidos podem ser perdidos.' : '') : 'Iniciando análise…');
  }
  function ensureWorker(){
    if(worker)return;
    worker=new Worker('juggle-worker.js?v=2');
    worker.onerror=e=>{console.error('REALPLAY worker:',e.message,e.filename,e.lineno);fail('Não foi possível carregar a IA. Confira a internet e tente em Chrome, Edge ou Safari atualizado.');};
    worker.onmessage=({data})=>{
      if(data.type==='ready'){clearTimeout(loadTimer);ready=true;if(active){status('IA pronta. Marque a linha do chão no quadro.');source.play().then(()=>{if(active)schedule();}).catch(()=>stop('Toque em play no vídeo e reative o contador.'));}}
      else if(data.type==='status'){if(active)status(data.text);}
      else if(data.type==='error'){console.error('REALPLAY reconhecimento:',data.text);fail('Falha no reconhecimento. Confira a internet e tente novamente. Se persistir, use outro navegador.');}
      else if(data.type==='result')onResult(data);
    };
    worker.postMessage({type:'load'});
    loadTimer=setTimeout(()=>fail('O download da IA demorou demais. Confira sua conexão e tente novamente.'),90000);
  }
  async function frame(){
    if(!active)return;
    raf=requestAnimationFrame(frame);
    if(!source || (el('juggleSource').value==='camera' && !source.srcObject)){
      stop('A câmera foi fechada. Abra novamente e ative o contador.');return;
    }
    if(source.seeking || source.paused || source.ended || source.readyState<2)return;
    if(source.currentTime===lastFrame || busy || !ready)return;
    if(performance.now()-lastStamp<65)return;
    const mySession=session, mediaTime=source.currentTime;
    busy=true;lastFrame=mediaTime;lastStamp=performance.now();
    try{
      const width=Math.min(source.videoWidth,640), height=Math.round(source.videoHeight*width/source.videoWidth);
      if(canvas.width!==width || canvas.height!==height){canvas.width=width;canvas.height=height;}
      ctx.drawImage(source,0,0,width,height);draw();
      const bitmap=await createImageBitmap(source,{resizeWidth:width,resizeHeight:height});
      if(!active || mySession!==session){bitmap.close();busy=false;return;}
      worker.postMessage({type:'frame',bitmap,t:lastStamp,mediaTime,session:mySession},[bitmap]);
    }catch(error){busy=false;fail('Este navegador não conseguiu analisar a imagem. Tente Chrome, Edge ou Safari atualizado.');}
  }
  function schedule(){cancelAnimationFrame(raf);raf=requestAnimationFrame(frame);}
  el('startJuggle').onclick=async()=>{
    if(active)return;
    if(!window.Worker || !window.createImageBitmap || !window.OffscreenCanvas){status('Análise indisponível neste navegador. Atualize o navegador ou use outro aparelho.');return;}
    const chosen=el('juggleSource').value==='camera' ? el('cameraPreview') : el('video');
    if(source!==chosen){floor=null;reset();}
    source=chosen;active=true;session++;lastFrame=-1;counter.clearTrack();controls();
    const startingSession=session;
    try{
      if(chosen===el('cameraPreview') && !chosen.srcObject)await el('openCamera').onclick();
      if(!active || session!==startingSession)return;
      if(chosen===el('cameraPreview') && !chosen.srcObject){stop('Abra a câmera e permita o acesso antes de contar.');return;}
      if(chosen===el('video') && chosen.ended){
        internalSeek=true;
        try {
          await new Promise((resolve,reject)=>{
            const timeout=setTimeout(()=>{chosen.removeEventListener('seeked',done);reject(new Error('rewind timeout'));},5000);
            function done(){clearTimeout(timeout);resolve();}
            chosen.addEventListener('seeked',done,{once:true});chosen.currentTime=0;
          });
        } finally {internalSeek=false;}
      }
      await chosen.play();
      if(!active || session!==startingSession)return;
      canvas.hidden=false;controls();
      status('Carregando IA no aparelho. O primeiro download pode levar um minuto…');
      if(!ready && chosen===el('video'))chosen.pause();
      ensureWorker();if(ready)schedule();
    }catch(error){stop('Não foi possível iniciar. Abra um vídeo ou permita o acesso à câmera e tente novamente.');}
  };
  el('stopJuggle').onclick=()=>stop();
  el('calibrateFloor').onclick=()=>{marking=true;status('Toque no chão, logo abaixo dos pés, no quadro de análise.');};
  canvas.onclick=e=>{
    if(floor!==null && !marking)return;
    const bounds=canvas.getBoundingClientRect();
    const y=(e.clientY-bounds.top)/bounds.height;
    if(y<0.35 || y>0.99){status('Marque o chão na parte inferior do quadro, abaixo dos pés.');return;}
    floor=y;marking=false;counter.clearTrack();
    el('floorStatus').textContent='Linha do chão calibrada. Recalibre se mover o aparelho.';
    status('Calibração concluída. A contagem acontece automaticamente.');
  };
  el('resetJuggle').onclick=()=>{reset();status(active?'Nova tentativa iniciada.':'Contador zerado. Ative a contagem para começar.');};
  el('juggleSource').onchange=()=>{floor=null;reset();canvas.hidden=true;source=null;controls();status(el('juggleSource').value==='camera'?'Modo ao vivo: toque em Ativar contador automático para abrir a câmera.':'Modo replay: será analisado o vídeo do painel Arena real, abaixo. Toque em Ativar contador automático.');el('juggleQuality').textContent='Detecção aguardando início.';el('floorStatus').textContent='Calibração necessária para a nova fonte.';};
  const player=el('video');
  player.addEventListener('seeking',()=>{if(source===player && !internalSeek){stop('Vídeo reposicionado. Inicie uma nova tentativa para evitar contar lances repetidos.');reset();}});
  player.addEventListener('loadstart',()=>{if(source===player){stop('Vídeo alterado. Ative o contador e recalibre o chão.');floor=null;reset();}});
  player.addEventListener('ended',()=>{if(source===player && active)stop('Vídeo concluído. Confira os resultados e salve a tentativa.');});
  function rankings(){try{const data=JSON.parse(localStorage.getItem(rankKey)||'[]');return Array.isArray(data)?data:[];}catch{return [];}}
  function renderRank(){
    const list=el('juggleRanking');list.replaceChildren();
    const rows=rankings().sort((a,b)=>b.best-a.best || b.total-a.total).slice(0,10);
    for(const r of rows){const li=document.createElement('li');li.textContent=r.name+' — '+r.best+' em sequência ('+r.total+' no total)';list.append(li);}
    if(!rows.length){const li=document.createElement('li');li.textContent='Nenhuma tentativa salva.';list.append(li);}
  }
  el('saveJuggle').onclick=()=>{
    if(active || savedAttempt || !counter.total){status(savedAttempt?'Esta tentativa já está salva.':'Pause a contagem após registrar pelo menos um toque.');return;}
    try{const rank=rankings();rank.push({name:el('name').value.trim()||'Jogador',total:counter.total,best:counter.best,date:new Date().toISOString(),verification:'estimativa automática experimental'});localStorage.setItem(rankKey,JSON.stringify(rank));savedAttempt=true;renderRank();status('Tentativa salva no ranking local de embaixadinhas.');}
    catch{status('O navegador bloqueou o ranking. Use Exportar análise para guardar o resultado.');}
  };
  el('exportJuggle').onclick=()=>{
    const data={mode:'embaixadinhas',version:1,total:counter.total,best:counter.best,floor,events:counter.events,verification:'estimativa automática experimental'};
    const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='realplay-embaixadinhas.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  window.addEventListener('pagehide',()=>{stop();worker?.terminate();worker=null;ready=false;busy=false;clearTimeout(loadTimer);});
  renderRank();metrics();controls();
})();
