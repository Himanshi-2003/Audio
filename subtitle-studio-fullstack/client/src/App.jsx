import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AudioLines, Captions, Check, ChevronDown, Clock3, Clapperboard, Download,
  FileAudio, FileJson, FolderOpen, LoaderCircle, Pause, Play, Plus, Save,
  Scissors, Settings2, Trash2, Upload, Video, Volume2, Waves, X, ZoomIn, ZoomOut
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";
const stamp = (n, millis = true) => {
  n = Math.max(0, Number(n) || 0);
  const h = Math.floor(n / 3600), m = Math.floor(n % 3600 / 60), s = Math.floor(n % 60);
  const f = Math.floor((n % 1) * (millis ? 1000 : 100));
  return `${h ? `${String(h).padStart(2,"0")}:` : ""}${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}.${String(f).padStart(millis?3:2,"0")}`;
};
const srtStamp = n => { const ms = Math.round(n * 1000); return `${String(Math.floor(ms/3600000)).padStart(2,"0")}:${String(Math.floor(ms%3600000/60000)).padStart(2,"0")}:${String(Math.floor(ms%60000/1000)).padStart(2,"0")},${String(ms%1000).padStart(3,"0")}`; };
function saveBlob(blob, name) { const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1500); }
async function request(url, options = {}) {
  const res = await fetch(`${API}${url}`, { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
export default function App() {
  const videoRef = useRef(null), fileRef = useRef(null), canvasRef = useRef(null), projectFileRef = useRef(null);
  const [projects, setProjects] = useState([]), [projectId, setProjectId] = useState(""), [projectName, setProjectName] = useState("Untitled project");
  const [subtitles, setSubtitles] = useState([]), [selected, setSelected] = useState("");
  const [start, setStart] = useState("0"), [end, setEnd] = useState("3"), [text, setText] = useState("");
  const [mediaUrl, setMediaUrl] = useState(""), [mediaName, setMediaName] = useState(""), [duration, setDuration] = useState(0), [current, setCurrent] = useState(0), [playing, setPlaying] = useState(false);
  const [peaks, setPeaks] = useState([]), [zoom, setZoom] = useState(1), [busy, setBusy] = useState(false), [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("Ready to edit"), [dbStatus, setDbStatus] = useState("checking"), [exportFormat, setExportFormat] = useState("srt");
  const [showProjects, setShowProjects] = useState(false);
  const toast = useCallback(msg => { setNotice(msg); }, []);
  const activeSubtitle = useMemo(() => subtitles.find(s => current >= s.start && current < s.end), [subtitles, current]);

  useEffect(() => {
    request("/api/health").then(d => setDbStatus(d.database)).catch(() => setDbStatus("offline"));
    request("/api/projects").then(d => setProjects(d.projects || [])).catch(() => setDbStatus("offline"));
  }, []);
  useEffect(() => () => { if (mediaUrl) URL.revokeObjectURL(mediaUrl); }, [mediaUrl]);
  const drawWave = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"), w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h); ctx.fillStyle = "#0b0e13"; ctx.fillRect(0,0,w,h);
    ctx.strokeStyle = "#242b36"; for (let i=1;i<4;i++){ctx.beginPath();ctx.moveTo(0,h*i/4);ctx.lineTo(w,h*i/4);ctx.stroke();}
    if (!peaks.length) { ctx.fillStyle="#737e90";ctx.font="14px system-ui";ctx.textAlign="center";ctx.fillText("Upload a video and generate its waveform",w/2,h/2);return; }
    const count = Math.max(1, Math.floor(peaks.length / zoom)), offset = Math.min(peaks.length-count,Math.floor((current/(duration||1))*peaks.length));
    const step = w/count;
    peaks.slice(offset,offset+count).forEach((p,i)=>{const bh=Math.max(2,p*h*.88);ctx.fillStyle=(offset+i)/peaks.length<current/(duration||1)?"#5c8d2a":"#a3e635";ctx.fillRect(i*step,h/2-bh/2,Math.max(1,step*.64),bh);});
    ctx.strokeStyle="#fb7185";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(current/(duration||1)*w,0);ctx.lineTo(current/(duration||1)*w,h);ctx.stroke();
  }, [peaks, zoom, current, duration]);
  useEffect(() => { drawWave(); }, [drawWave]);

  const refreshProjects = async () => { try { setProjects((await request("/api/projects")).projects || []); } catch { setDbStatus("offline"); } };
  const createProject = async () => {
    try { const { project } = await request("/api/projects", { method:"POST", body:JSON.stringify({name:projectName}) }); setProjectId(project._id); setProjectName(project.name); setSubtitles([]); setSelected(""); await refreshProjects(); toast("Project created and saved to MongoDB."); }
    catch (e) { toast(`Could not create project: ${e.message}`); }
  };
  const loadProject = async id => {
    try { const {project} = await request(`/api/projects/${id}`); setProjectId(project._id); setProjectName(project.name); setSubtitles((project.subtitles||[]).map(s=>({...s,id:s._id}))); setSelected(""); setShowProjects(false); toast("Project loaded from MongoDB. Re-select its video to preview."); }
    catch(e){toast(`Could not load project: ${e.message}`);}
  };
  const saveProject = async () => {
    setSaving(true);
    try {
      let id = projectId;
      if (!id) { const {project} = await request("/api/projects",{method:"POST",body:JSON.stringify({name:projectName})}); id=project._id;setProjectId(id); }
      await request(`/api/projects/${id}`,{method:"PATCH",body:JSON.stringify({name:projectName})});
      const clean = subtitles.map(s=>({start:Number(s.start),end:Number(s.end),text:s.text}));
      const {project} = await request(`/api/projects/${id}/subtitles`,{method:"PUT",body:JSON.stringify({subtitles:clean})});
      setSubtitles((project.subtitles||[]).map(s=>({...s,id:s._id}))); await refreshProjects(); toast("Project and subtitles saved to MongoDB.");
    } catch(e) { toast(`Save failed: ${e.message}. Check MongoDB connection and server/.env.`); }
    finally { setSaving(false); }
  };
  const selectMedia = file => {
    if (!file) return;
    if (!file.type.startsWith("video/")) { toast("Please choose a video file."); return; }
    setMediaUrl(old => { if(old) URL.revokeObjectURL(old); return URL.createObjectURL(file); });
    setMediaName(file.name); setPeaks([]); setDuration(0); setCurrent(0); toast("Video loaded locally. Media is not uploaded to the backend.");
  };
  const selectSubtitle = s => { setSelected(s.id); setStart(String(s.start)); setEnd(String(s.end)); setText(s.text); if(videoRef.current) videoRef.current.currentTime=s.start; };
  const resetEditor = () => { setSelected(""); setStart((current||0).toFixed(2)); setEnd(Math.min(duration||current+3,current+3).toFixed(2)); setText(""); };
  const saveSubtitle = () => {
    const a=Number(start),b=Number(end),t=text.trim();
    if(!Number.isFinite(a)||!Number.isFinite(b)||a<0||b<=a||!t){toast("Enter subtitle text and valid times (end must be after start).");return;}
    if(selected) setSubtitles(old=>old.map(s=>s.id===selected?{...s,start:a,end:b,text:t}:s));
    else {const id=crypto.randomUUID();setSubtitles(old=>[...old,{id,start:a,end:b,text:t}]);setSelected(id);}
    toast("Subtitle updated. Click Save project to persist it in MongoDB.");
  };
  const deleteSubtitle = id => {setSubtitles(old=>old.filter(s=>s.id!==id));if(selected===id)resetEditor();toast("Subtitle removed. Save project to persist changes.");};
  const generateWave = async () => {
    const v=videoRef.current;if(!v||!mediaUrl){toast("Upload a video first.");return;}
    setBusy(true);toast("Analyzing audio…");
    try {
      const response=await fetch(mediaUrl),array=await response.arrayBuffer(),AudioContextClass=window.AudioContext||window.webkitAudioContext;
      if(!AudioContextClass)throw new Error("Web Audio API is not supported.");
      const ac=new AudioContextClass();let buffer;
      try{buffer=await ac.decodeAudioData(array);}finally{await ac.close();}
      const data=buffer.getChannelData(0),samples=Math.min(14000,Math.max(1000,Math.floor(data.length/300))),block=Math.max(1,Math.floor(data.length/samples)),p=[];
      for(let i=0;i<samples;i++){let peak=0;for(let j=0;j<block;j++)peak=Math.max(peak,Math.abs(data[i*block+j]||0));p.push(peak);}
      setPeaks(p);toast(`Waveform generated · ${buffer.sampleRate.toLocaleString()} Hz · ${buffer.numberOfChannels} channel(s)`);
    } catch(e){toast(`Could not decode audio: ${e.message}. The browser may not support this codec.`);}
    finally{setBusy(false);}
  };
  const extractAudio = async () => {
    if(!mediaUrl){toast("Upload a video first.");return;}
    try {
      const response=await fetch(mediaUrl),array=await response.arrayBuffer(),AC=window.AudioContext||window.webkitAudioContext,ac=new AC();
      let b;try{b=await ac.decodeAudioData(array);}finally{await ac.close();}
      const channels=b.numberOfChannels,frames=b.length,bytes=2,interleaved=new Float32Array(frames*channels);
      for(let i=0;i<frames;i++)for(let c=0;c<channels;c++)interleaved[i*channels+c]=b.getChannelData(c)[i];
      const out=new ArrayBuffer(44+interleaved.length*bytes),view=new DataView(out),write=(o,s)=>{for(let i=0;i<s.length;i++)view.setUint8(o+i,s.charCodeAt(i));};
      write(0,"RIFF");view.setUint32(4,36+interleaved.length*2,true);write(8,"WAVE");write(12,"fmt ");view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channels,true);view.setUint32(24,b.sampleRate,true);view.setUint32(28,b.sampleRate*channels*2,true);view.setUint16(32,channels*2,true);view.setUint16(34,16,true);write(36,"data");view.setUint32(40,interleaved.length*2,true);
      let o=44;for(const sample of interleaved){const s=Math.max(-1,Math.min(1,sample));view.setInt16(o,s<0?s*32768:s*32767,true);o+=2;}
      saveBlob(new Blob([out],{type:"audio/wav"}),`${projectName||"audio"}.wav`);toast("Extracted audio and downloaded WAV.");
    } catch(e){toast(`Audio extraction failed: ${e.message}. Try an MP4/WebM with a browser-supported audio codec.`);}
  };
  const exportSubs = format => {
    const sorted=[...subtitles].sort((a,b)=>a.start-b.start);
    let content=format==="vtt"?"WEBVTT\n\n": "";
    content += sorted.map((s,i)=>`${format==="srt"?`${i+1}\n`:""}${format==="vtt"?srtStamp(s.start).replace(",","."):srtStamp(s.start)} --> ${format==="vtt"?srtStamp(s.end).replace(",","."):srtStamp(s.end)}\n${s.text}`).join("\n\n")+"\n";
    saveBlob(new Blob([content],{type:format==="vtt"?"text/vtt":"text/plain"}),`${projectName||"subtitles"}.${format}`);
    toast(`${format.toUpperCase()} exported.`);
  };
  const exportJSON = () => saveBlob(new Blob([JSON.stringify({name:projectName,subtitles:subtitles.map(({start,end,text})=>({start,end,text}))},null,2)],{type:"application/json"}),`${projectName||"project"}.json`);
  const importJSON = async e => {const file=e.target.files?.[0];if(!file)return;try{const data=JSON.parse(await file.text());setProjectName(data.name||"Imported project");setSubtitles((data.subtitles||[]).map(s=>({...s,id:crypto.randomUUID()})));setProjectId("");setSelected("");toast("Project JSON imported. Save project to store it in MongoDB.");}catch{toast("Invalid project JSON.");}e.target.value="";};
  const splitSubtitle = () => {const s=subtitles.find(x=>x.id===selected),t=current;if(!s||t<=s.start||t>=s.end){toast("Select a subtitle and place the playhead inside it.");return;}setSubtitles(old=>[...old.map(x=>x.id===s.id?{...x,end:t}:x),{id:crypto.randomUUID(),start:t,end:s.end,text:s.text}]);setEnd(String(t));toast("Subtitle split. Save project to persist changes.");};
  const playheadClick = e => {if(!duration)return;const r=e.currentTarget.getBoundingClientRect();const time=Math.max(0,Math.min(duration,(e.clientX-r.left)/r.width*duration/zoom));if(videoRef.current)videoRef.current.currentTime=time;};
  const onVideoTime = () => {const v=videoRef.current;if(v){setCurrent(v.currentTime);setPlaying(!v.paused);}};
  const makeTimed = () => {if(!duration){toast("Upload a video first.");return;}if(!window.confirm("Create blank subtitle placeholders every 3 seconds?"))return;const arr=[];for(let t=0;t<duration;t+=3)arr.push({id:crypto.randomUUID(),start:t,end:Math.min(t+3,duration),text:""});setSubtitles(arr);toast("Placeholders created. Fill in each subtitle.");};
  const viewDuration=(duration||60)/zoom;

  return <div className="appShell">
    <header className="topbar">
      <div className="brand"><div className="brandIcon"><Captions size={19}/></div><div><strong>Subtitle Studio</strong><small>VIDEO WORKSPACE</small></div></div>
      <div className="projectLabel"><Clapperboard size={15}/><input aria-label="Project name" value={projectName} onChange={e=>setProjectName(e.target.value)} /></div>
      <div className="topActions"><span className={`dbPill ${dbStatus}`}><span/>MongoDB {dbStatus}</span><button className="btn" onClick={()=>setShowProjects(x=>!x)}><FolderOpen size={15}/> Projects <ChevronDown size={13}/></button><button className="btn primary" onClick={saveProject} disabled={saving}><Save size={15}/>{saving?"Saving…":"Save project"}</button></div>
    </header>
    {showProjects&&<div className="projectDropdown"><div className="dropHead"><strong>Saved projects</strong><button className="iconBtn" onClick={()=>setShowProjects(false)}><X size={15}/></button></div><button className="dropNew" onClick={createProject}><Plus size={15}/> Create new project</button>{projects.length===0?<p className="muted">No saved projects yet.</p>:projects.map(p=><button className="projectItem" key={p._id} onClick={()=>loadProject(p._id)}><span>{p.name}</span><small>{new Date(p.updatedAt).toLocaleDateString()}</small></button>)}</div>}
    <main className="workspace">
      <section className="column leftColumn">
        <div className="panel">
          <div className="panelHead"><div className="heading"><Video size={16}/><h2>Video preview</h2></div><span className="badge">{mediaName||"No media loaded"}</span></div>
          <div className="videoArea"><div className="videoFrame" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();selectMedia(e.dataTransfer.files?.[0]);}}>
            <video ref={videoRef} src={mediaUrl||undefined} onLoadedMetadata={e=>setDuration(e.currentTarget.duration||0)} onTimeUpdate={onVideoTime} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} />
            {!mediaUrl&&<div className="emptyState"><div className="emptyIcon"><Upload size={23}/></div><strong>Bring your video to life</strong><p>Drop a video here or browse files</p><button className="btn primary" onClick={()=>fileRef.current?.click()}><Upload size={15}/> Upload video</button><small>MP4 · WebM · MOV · browser-supported formats</small></div>}
            {mediaUrl&&activeSubtitle&&<div className="captionOverlay">{activeSubtitle.text}</div>}
          </div><input ref={fileRef} type="file" accept="video/*" hidden onChange={e=>selectMedia(e.target.files?.[0])}/>
          <div className="transport"><button className="transportPlay" onClick={()=>{const v=videoRef.current;if(!v)return;v.paused?v.play():v.pause();}} disabled={!mediaUrl}>{playing?<Pause size={17}/>:<Play size={17} fill="currentColor"/>}</button><button className="btn" onClick={()=>{if(videoRef.current)videoRef.current.currentTime=Math.max(0,current-5)}}>−5s</button><button className="btn" onClick={()=>{if(videoRef.current)videoRef.current.currentTime=Math.min(duration,current+5)}}>+5s</button><span className="timeRead">{stamp(current)} <span>/ {stamp(duration)}</span></span><button className="btn" onClick={()=>{resetEditor();setStart(current.toFixed(2));setEnd(Math.min(duration||current+3,current+3).toFixed(2));}}><Plus size={15}/> Subtitle at playhead</button></div>
          <div className="mediaActions"><button className="btn" onClick={()=>fileRef.current?.click()}><Upload size={14}/> Choose video</button><button className="btn" onClick={extractAudio} disabled={!mediaUrl}><FileAudio size={14}/> Extract audio</button><span className="muted tiny">Video stays on this device</span></div></div>
        </div>
        <div className="panel">
          <div className="panelHead"><div className="heading"><Captions size={16}/><h2>Subtitle editor</h2></div><div className="inlineActions"><button className="btn compact" onClick={resetEditor}><Plus size={14}/> Add line</button><button className="btn compact" onClick={makeTimed}>Auto-create</button></div></div>
          <div className="editorForm"><div className="formGrid"><label>START TIME (SECONDS)<input type="number" min="0" step=".01" value={start} onChange={e=>setStart(e.target.value)}/></label><label>END TIME (SECONDS)<input type="number" min="0" step=".01" value={end} onChange={e=>setEnd(e.target.value)}/></label></div><label className="textLabel">SUBTITLE TEXT<textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Type subtitle text for this segment…"/></label><div className="inlineActions"><button className="btn primary" onClick={saveSubtitle}><Check size={15}/> {selected?"Update subtitle":"Add subtitle"}</button><button className="btn" onClick={splitSubtitle}><Scissors size={14}/> Split at playhead</button><button className="btn" onClick={resetEditor}>Clear</button></div><p className="hint">Select a subtitle below to edit its text and timing.</p></div>
          <div className="subHead"><strong>Subtitle track</strong><span className="badge">{subtitles.length} lines</span></div>
          <div className="subtitleList">{subtitles.length===0?<div className="listEmpty"><Captions size={21}/><span>No subtitles yet</span><small>Add a line to start building your track.</small></div>:subtitles.map((s,i)=><div key={s.id} className={`subtitleRow ${selected===s.id?"selected":""}`} onClick={()=>selectSubtitle(s)}><span className="rowIndex">{String(i+1).padStart(2,"0")}</span><span className="rowTime">{stamp(s.start,false)}</span><span className="rowText">{s.text||<em>Empty subtitle</em>}</span><button className="iconBtn danger" aria-label="Delete subtitle" onClick={e=>{e.stopPropagation();deleteSubtitle(s.id);}}><Trash2 size={14}/></button></div>)}</div>
        </div>
      </section>
      <section className="column rightColumn">
        <div className="panel">
          <div className="panelHead"><div className="heading"><Waves size={16}/><h2>Audio waveform</h2></div><button className="btn compact" onClick={generateWave} disabled={!mediaUrl||busy}>{busy?<LoaderCircle size={14} className="spin"/>:<AudioLines size={14}/>} Generate waveform</button></div>
          <div className="waveArea"><canvas ref={canvasRef} width="1200" height="230" onClick={playheadClick} aria-label="Audio waveform. Click to seek."/><div className="waveMeta"><span>{peaks.length?`Waveform ready · ${peaks.length.toLocaleString()} samples`:"Upload a video to analyze its audio."}</span><span>{stamp(duration)}</span></div><div className="inlineActions waveButtons"><button className="btn" onClick={()=>setZoom(z=>Math.max(1,z/1.5))}><ZoomOut size={14}/> Zoom out</button><button className="btn" onClick={()=>setZoom(z=>Math.min(8,z*1.5))}><ZoomIn size={14}/> Zoom in</button><button className="btn" onClick={()=>canvasRef.current?.toBlob(b=>b&&saveBlob(b,"waveform.png"))}><Download size={14}/> PNG</button></div></div>
        </div>
        <div className="panel">
          <div className="panelHead"><div className="heading"><Clock3 size={16}/><h2>Timeline</h2></div><button className="btn compact" onClick={()=>setZoom(1)}>Fit timeline</button></div>
          <div className="timelineArea"><div className="ruler">{Array.from({length:6},(_,i)=><span key={i}>{stamp(viewDuration*i/5,false)}</span>)}</div>
            <div className="track" onClick={playheadClick}><span className="trackName">VIDEO / AUDIO</span>{mediaUrl&&<div className="videoClip" style={{left:0,width:`${Math.min(100,100*zoom)}%`}}>Video · {mediaName}</div>}<div className="trackPlayhead" style={{left:`${Math.min(100,current/(viewDuration||1)*100)}%`}}/></div>
            <div className="track subtitleTrack" onClick={playheadClick}><span className="trackName">SUBTITLES</span>{subtitles.map(s=><button title={s.text} key={s.id} className={`subtitleClip ${selected===s.id?"clipSelected":""}`} style={{left:`${s.start/viewDuration*100}%`,width:`${Math.max(.7,(s.end-s.start)/viewDuration*100)}%`}} onClick={e=>{e.stopPropagation();selectSubtitle(s);}}>{s.text||"Subtitle"}</button>)}<div className="trackPlayhead" style={{left:`${Math.min(100,current/(viewDuration||1)*100)}%`}}/></div>
            <div className="timelineFoot"><span>Click a track to seek · select clips to edit</span><span>{zoom.toFixed(1)}× zoom</span></div>
          </div>
        </div>
        <div className="panel">
          <div className="panelHead"><div className="heading"><Settings2 size={16}/><h2>Project & export</h2></div><span className={`badge ${dbStatus==="connected"?"good":""}`}>{dbStatus==="connected"?"Database connected":dbStatus==="offline"?"API unavailable":`DB ${dbStatus}`}</span></div>
          <div className="exportArea"><label className="textLabel">SUBTITLE FORMAT<select value={exportFormat} onChange={e=>setExportFormat(e.target.value)}><option value="srt">SubRip (.srt)</option><option value="vtt">WebVTT (.vtt)</option></select></label><div className="exportGrid"><button className="btn primary" onClick={()=>exportSubs(exportFormat)}><Download size={14}/> Export subtitles</button><button className="btn" onClick={exportJSON}><FileJson size={14}/> Export JSON</button><button className="btn" onClick={()=>projectFileRef.current?.click()}><FolderOpen size={14}/> Import JSON</button><input ref={projectFileRef} hidden type="file" accept=".json,application/json" onChange={importJSON}/></div><div className="tip"><Volume2 size={15}/><p><strong>Local media, persistent project.</strong><br/>Video and waveform processing run in your browser. Project names and subtitle text/timings are saved to MongoDB when you click Save project. Speech-to-text transcription is not included.</p></div></div>
        </div>
      </section>
    </main>
    <footer className="statusbar"><span><span className="statusDot"/> {notice}</span><span>Subtitle Studio <b>·</b> React + Express + MongoDB</span></footer>
  </div>;
}