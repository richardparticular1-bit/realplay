const test=require('node:test'),assert=require('node:assert/strict'),Counter=require('./juggle-core.js');
const foot={x:.5,y:.78,visibility:.95};
function bounce(c,{start=0,footVisible=true,floor=.95,confidence=.9,x=.5}={}){const ys=[.42,.46,.51,.57,.64,.70,.73,.69,.64,.59,.54,.50];let hits=[];ys.forEach((y,i)=>{const hit=c.sample({x,y,r:.035,t:start+i*65,confidence,feet:footVisible?[foot]:[]},floor);if(hit)hits.push(hit)});return hits;}
test('one touch for descending ball reversing upward near foot',()=>{const c=new Counter();assert.equal(bounce(c).length,1);assert.equal(c.total,1)});
test('repeat cycles count separately',()=>{const c=new Counter();bounce(c);bounce(c,{start:900});assert.equal(c.total,2);assert.equal(c.best,2)});
test('no foot, low confidence and distant ball never count',()=>{for(const options of [{footVisible:false},{confidence:.3},{x:.1}]){const c=new Counter();bounce(c,options);assert.equal(c.total,0)}});
test('ground bounce rejected',()=>{const c=new Counter();bounce(c,{floor:.76});assert.equal(c.total,0)});
test('stationary jitter near foot rejected',()=>{const c=new Counter();for(let i=0;i<30;i++)c.sample({x:.5,y:.72+Math.sin(i)*.002,r:.035,t:i*65,confidence:.9,feet:[foot]},.95);assert.equal(c.total,0)});
test('missing frames cannot bridge a contact into a false touch',()=>{const c=new Counter();[.45,.50,.60,.70,.73].forEach((y,i)=>c.sample({x:.5,y,r:.035,t:i*65,confidence:.9,feet:[foot]},.95));c.missing(1000);[.69,.65,.60].forEach((y,i)=>c.sample({x:.5,y,r:.035,t:1100+i*65,confidence:.9,feet:[foot]},.95));assert.equal(c.total,0)});
test('seeking backwards resets trajectory',()=>{const c=new Counter();bounce(c);const before=c.total;c.sample({x:.5,y:.7,r:.035,t:0,confidence:.9,feet:[foot]},.95);assert.equal(c.total,before)});
test('floor required, reset clears session',()=>{const c=new Counter();bounce(c,{floor:null});assert.equal(c.total,0);bounce(c,{start:1000});c.reset();assert.equal(c.total,0);assert.equal(c.events.length,0)});
