(() => {
  const byId = id => document.getElementById(id);
  const preview = byId('cameraPreview'), status = byId('cameraStatus');
  const open = byId('openCamera'), start = byId('startRecording'), stop = byId('stopRecording'), close = byId('closeCamera');
  let stream = null, recorder = null, chunks = [], resultUrl = null, timer = null, began = 0, opening = false;
  function controls(recording = false) {
    open.disabled = opening || !!stream;
    start.disabled = !stream || recording || !window.MediaRecorder;
    stop.disabled = !recording;
    close.disabled = !stream || recording;
    byId('recordAudio').disabled = opening || !!stream;
  }
  function release() {
    if (stream) stream.getTracks().forEach(track => track.stop());
    stream = null; preview.srcObject = null; preview.hidden = true; controls();
  }
  function showRecording(blob) {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrl = URL.createObjectURL(blob);
    const link = byId('downloadRecording');
    link.href = resultUrl; link.download = 'realplay-' + Date.now() + (blob.type.includes('mp4') ? '.mp4' : '.webm'); link.hidden = false;
    video.pause(); video.src = resultUrl; video.load();
    status.textContent = 'Gravação pronta no player. Baixe o vídeo antes de fechar a página. Escolha Vídeo do player no contador automático para analisar embaixadinhas no replay.';
  }
  open.onclick = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {status.textContent = 'Câmera indisponível. Abra o site por HTTPS ou use Gravar pelo celular.'; return;}
    opening = true; controls(); status.textContent = 'Aguardando permissão da câmera…';
    try {
      stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:byId('recordAudio').checked});
      preview.srcObject = stream; preview.hidden = false;
      await preview.play();
      status.textContent = window.MediaRecorder ? 'Câmera pronta. Ative o contador de embaixadinhas acima ou toque em Iniciar gravação.' : 'Este navegador não suporta gravação direta. Use Gravar pelo celular.';
    } catch (e) {
      release();
      status.textContent = e.name === 'NotAllowedError' ? 'Acesso negado. Permita a câmera nas configurações deste site ou use Gravar pelo celular.' : 'Não foi possível abrir a câmera. Confira se está disponível; se ativou o microfone, tente sem ele.';
    } finally {opening = false; controls();}
  };
  start.onclick = () => {
    if (!stream || recorder?.state === 'recording') return;
    try {
      const mimeType = ['video/mp4','video/webm;codecs=vp8,opus','video/webm'].find(type => MediaRecorder.isTypeSupported(type));
      recorder = mimeType ? new MediaRecorder(stream,{mimeType}) : new MediaRecorder(stream);
      chunks = []; let failed = false;
      recorder.ondataavailable = e => {if(e.data.size) chunks.push(e.data);};
      recorder.onerror = () => {failed = true; status.textContent = 'Falha na gravação. Tente novamente ou use Gravar pelo celular.';};
      recorder.onstop = () => {
        clearInterval(timer); const type = recorder.mimeType || chunks[0]?.type || 'video/webm';
        const blob = new Blob(chunks,{type});
        release();
        if (blob.size) showRecording(blob);
        else status.textContent = 'Nenhum vídeo foi gravado. Tente novamente.';
        if(failed && blob.size) status.textContent += ' A gravação foi interrompida; confira o vídeo.';
      };
      recorder.start(1000); began = Date.now(); controls(true);
      const tick = () => {status.textContent = 'Gravando • ' + Math.floor((Date.now()-began)/1000) + ' s — limite de 3 minutos'; if(Date.now()-began >= 180000 && recorder.state === 'recording') recorder.stop();};
      tick(); timer = setInterval(tick,1000);
    } catch(e) {clearInterval(timer); controls(); status.textContent = 'Formato de gravação indisponível. Use Gravar pelo celular.';}
  };
  stop.onclick = () => {if(recorder?.state === 'recording'){stop.disabled = true; status.textContent = 'Finalizando vídeo…';recorder.stop();}};
  close.onclick = () => {release();status.textContent = 'Câmera desligada.';};
  byId('captureVideo').onchange = e => {const file = e.target.files[0];if(file)showRecording(file);};
  window.addEventListener('pagehide', () => {clearInterval(timer);release();if(resultUrl)URL.revokeObjectURL(resultUrl);});
  controls();
})();
