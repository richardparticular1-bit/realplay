# REALPLAY

[Abra o jogo](https://richardparticular1-bit.github.io/realplay/) no navegador do celular, tablet ou computador.

## Embaixadinhas automáticas (experimental)
1. Mantenha o aparelho fixo e uma única pessoa e bola de futebol no quadro. Ilumine bem e enquadre os pés.
2. Escolha Câmera ao vivo ou Vídeo do player. Para um arquivo próprio, abra o vídeo no painel Arena real.
3. Toque em Ativar contador automático e aguarde o download dos modelos.
4. No quadro de análise, toque no chão logo abaixo dos pés. Recalibre se mover o aparelho.
5. Execute as embaixadinhas: a estimativa exige descida, proximidade do pé e subida confirmada. O primeiro toque pode não ser contado se a descida não for visível.
6. Pause para salvar o resultado no ranking exclusivo de embaixadinhas. Exporte a análise para guardar os tempos dos eventos. Detecções entre 20% e 45% são exibidas em amarelo para diagnóstico e não geram contagem.

A IA roda em um Web Worker no aparelho. EfficientDet Lite0 encontra bolas com foco na região inferior de imagens verticais e tentativa de aceleração gráfica (retorno a CPU quando indisponível); Pose Landmarker Lite localiza os pés. Downloads iniciais usam jsDelivr e Google Storage. Não enviamos imagens aos servidores do REALPLAY. Internet necessária para baixar os modelos.

**Limites:** estimativa, sem validação de precisão em uma base rotulada de embaixadinhas. Pode perder toques rápidos ou ocultos e confundir quiques próximos dos pés. Use o replay para conferir. A linha do chão é uma aproximação 2D; não é um árbitro certificado. Objetos pequenos, câmera móvel, duas bolas e pés fora de quadro prejudicam a análise.

## Gravação e pontuação
Abrir câmera > Iniciar gravação > Parar gravação > Baixar gravação. Áudio opcional, limite de três minutos. O contador pode operar junto da gravação; ao parar a gravação, reative o contador na fonte Vídeo do player para analisar o replay. Gols permanecem manuais e têm ranking separado.

Ranking salvo apenas no navegador. Vídeos gravados precisam ser baixados antes de fechar a página.

## Publicação e testes
GitHub Pages: main, / (root). Para testar localmente, sirva a pasta por localhost. Não abra via file:// para análise com Worker.

`node --test test-juggle.cjs` valida trajetórias sintéticas: toque válido, repetição, jitter, chão, oclusão e confiança baixa. `node test-camera.cjs` verifica os controles de gravação com dispositivos simulados. Os testes não medem a precisão visual dos modelos em situações reais.

MediaPipe Tasks Vision 0.10.32, Apache-2.0. Veja THIRD_PARTY_NOTICES.md e LICENSE-mediapipe.txt.

## Diagnóstico visual
Uma amostra comprimida de captura de tela foi testada localmente: a bola, antes rejeitada, foi localizada com cerca de 25% de confiança pelo modelo com recorte. Isso é insuficiente para pontuar; o marcador amarelo permite ajustar o enquadramento. Não foi possível validar toques nesse trecho sem jogador visível. Ganho de velocidade no tablet ainda requer novo teste no aparelho.
