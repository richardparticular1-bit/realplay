self.exports = {};
importScripts('vision-bundle.js');
const {FilesetResolver,ObjectDetector,PoseLandmarker} = self.exports;
let detector, pose, detectorBackend='CPU', poseBackend='CPU';
const crop = new OffscreenCanvas(320,320), cropContext = crop.getContext('2d');
self.onmessage = async ({data}) => {
  if (data.type === 'load') {
    try {
      const files = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm');
      self.postMessage({type:'status',text:'Carregando detector de bola…'});
      const detectorOptions={runningMode:'VIDEO',scoreThreshold:0.2,categoryAllowlist:['sports ball'],maxResults:3};
      try {
        detector=await ObjectDetector.createFromOptions(files, {...detectorOptions,baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/latest/efficientdet_lite0.tflite',delegate:'GPU'}});
        detectorBackend='GPU';
      } catch(error) {
        detector=await ObjectDetector.createFromOptions(files, {...detectorOptions,baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-tasks/object_detector/efficientdet_lite0_uint8.tflite',delegate:'CPU'}});
      }
      self.postMessage({type:'status',text:'Carregando reconhecimento dos pés…'});
      const poseOptions={runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:0.5,minPosePresenceConfidence:0.5,minTrackingConfidence:0.5};
      const posePath='https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
      try {
        pose=await PoseLandmarker.createFromOptions(files,{...poseOptions,baseOptions:{modelAssetPath:posePath,delegate:'GPU'}});poseBackend='GPU';
      } catch(error) {
        pose=await PoseLandmarker.createFromOptions(files,{...poseOptions,baseOptions:{modelAssetPath:posePath,delegate:'CPU'}});
      }
      self.postMessage({type:'ready'});
    } catch (error) {self.postMessage({type:'error',text:String(error.message || error)});}
    return;
  }
  if (data.type === 'frame') {
    const {bitmap,t,session,mediaTime} = data;
    const began=Date.now();
    try {
      // Portrait frames otherwise shrink a small ball into a few model pixels.
      // Keep the lower square containing the feet at the detector's full input size.
      const region=bitmap.height>bitmap.width*1.2 ? {x:0,y:bitmap.height-bitmap.width,w:bitmap.width,h:bitmap.width} : {x:0,y:0,w:bitmap.width,h:bitmap.height};
      cropContext.drawImage(bitmap,region.x,region.y,region.w,region.h,0,0,320,320);
      const objects = detector.detectForVideo(crop,t);
      const balls = objects.detections.map(d => ({
        x:(region.x+(d.boundingBox.originX+d.boundingBox.width/2)*region.w/320)/bitmap.width,
        y:(region.y+(d.boundingBox.originY+d.boundingBox.height/2)*region.h/320)/bitmap.height,
        r:Math.max(d.boundingBox.width*region.w/320,d.boundingBox.height*region.h/320)/2/bitmap.height,
        confidence:d.categories[0].score
      }));
      // No foot inference is needed while there is no countable ball candidate.
      const body=balls.length===1 && balls[0].confidence>=0.45 ? pose.detectForVideo(bitmap,t) : {landmarks:[]};
      const landmarks = body.landmarks[0] || [];
      const feet = [27,28,29,30,31,32].map(i => landmarks[i]).filter(Boolean).map(f=>({x:f.x,y:f.y,visibility:f.visibility ?? 0}));
      self.postMessage({type:'result',balls,feet,t,session,mediaTime,region:{x:region.x/bitmap.width,y:region.y/bitmap.height,w:region.w/bitmap.width,h:region.h/bitmap.height},backend:detectorBackend+'/'+poseBackend,inferenceMs:Date.now()-began});
    } catch(error) {self.postMessage({type:'error',text:String(error.message || error)});}
    finally {bitmap.close();}
  }
};
