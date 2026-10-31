self.exports = {};
importScripts('vision-bundle.js');
const {FilesetResolver,ObjectDetector,PoseLandmarker} = self.exports;
let detector, pose;
self.onmessage = async ({data}) => {
  if (data.type === 'load') {
    try {
      const files = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm');
      self.postMessage({type:'status',text:'Carregando detector de bola…'});
      detector = await ObjectDetector.createFromOptions(files, {
        baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-tasks/object_detector/efficientdet_lite0_uint8.tflite',delegate:'CPU'},
        runningMode:'VIDEO',scoreThreshold:0.45,categoryAllowlist:['sports ball'],maxResults:3
      });
      self.postMessage({type:'status',text:'Carregando reconhecimento dos pés…'});
      pose = await PoseLandmarker.createFromOptions(files, {
        baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',delegate:'CPU'},
        runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:0.5,minPosePresenceConfidence:0.5,minTrackingConfidence:0.5
      });
      self.postMessage({type:'ready'});
    } catch (error) {self.postMessage({type:'error',text:String(error.message || error)});}
    return;
  }
  if (data.type === 'frame') {
    const {bitmap,t,session,mediaTime} = data;
    try {
      const objects = detector.detectForVideo(bitmap,t);
      const body = pose.detectForVideo(bitmap,t);
      const balls = objects.detections.map(d => ({
        x:(d.boundingBox.originX+d.boundingBox.width/2)/bitmap.width,
        y:(d.boundingBox.originY+d.boundingBox.height/2)/bitmap.height,
        r:Math.max(d.boundingBox.width,d.boundingBox.height)/2/bitmap.height,
        confidence:d.categories[0].score
      }));
      const landmarks = body.landmarks[0] || [];
      const feet = [27,28,29,30,31,32].map(i => landmarks[i]).filter(Boolean).map(f=>({x:f.x,y:f.y,visibility:f.visibility ?? 0}));
      self.postMessage({type:'result',balls,feet,t,session,mediaTime});
    } catch(error) {self.postMessage({type:'error',text:String(error.message || error)});}
    finally {bitmap.close();}
  }
};
