const { createClient } = window.supabase;
const cfg = window.RUDRAKSH_CONFIG || {};
const app = document.getElementById('app');
const ready = typeof cfg.SUPABASE_URL === 'string' && cfg.SUPABASE_URL.startsWith('https://') && typeof cfg.SUPABASE_ANON_KEY === 'string' && cfg.SUPABASE_ANON_KEY.startsWith('sb_');
const sb = ready ? createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
let user=null, profile=null, timer=null;
const state={tab:'dashboard',teacher:{questions:[],tests:[],students:[],reports:[]},student:{tests:[],progress:[],attemptAnswers:{}},attempt:null};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>v?new Date(v).toLocaleString():'—';
const money=v=>Number(v||0).toFixed(2);
const btn=(t,id='',k='primary',x='')=>`<button class="btn ${k}" id="${id}" ${x}>${t}</button>`;
const shell=(title,subtitle,body,actions='')=>`<header class="topbar"><div class="brand">RUDRAKSH CBT EXAMINATION</div><div>${actions}</div></header><main class="container"><section class="hero"><h1>${esc(title)}</h1><p>${esc(subtitle||'Professional online CBT management system')}</p></section>${body}</main>`;
const empty=t=>`<div class="empty">${esc(t)}</div>`;
async function boot(){if(!ready)return setupScreen();const {data:{session}}=await sb.auth.getSession();user=session?.user||null;if(!user)return loginScreen();await loadProfile();}
function setupScreen(){app.innerHTML=shell('Online setup required','The website is online, but Supabase configuration is missing.',`<section class="card"><div class="notice"><b>One-time setup:</b> update <code>config.js</code> with the Supabase Project URL and Publishable key.</div></section>`);}
function loginScreen(message=''){app.innerHTML=shell('Secure Login','Teacher and Student access',`<section class="card login-card"><h2>Sign in</h2><p class="muted">Use your registered email and password.</p>${message?`<div class="error">${esc(message)}</div>`:''}<label>Email address<input id="email" type="email" autocomplete="username" placeholder="Teacher / Student email"></label><label>Password<input id="password" type="password" autocomplete="current-password" placeholder="Password"></label><div class="row gap top16">${btn('Sign in','loginBtn')}</div><p id="loginMsg" class="muted small"></p></section>`);document.getElementById('loginBtn').onclick=login;}
async function login(){const email=document.getElementById('email').value.trim(),password=document.getElementById('password').value,msg=document.getElementById('loginMsg');if(!email||!password){msg.textContent='Enter email and password.';return;}msg.textContent='Signing in…';const {data,error}=await sb.auth.signInWithPassword({email,password});if(error){msg.textContent=error.message;return;}user=data.user;await loadProfile();}
async function loadProfile(){const {data:p,error}=await sb.from('profiles').select('id,role,full_name,user_code').eq('id',user.id).single();if(error||!p){loginScreen('Your account exists, but its profile is not ready.');return;}profile=p;state.tab='dashboard';renderApp();}
async function logout(){clearInterval(timer);await sb.auth.signOut();user=null;profile=null;state.attempt=null;loginScreen();}
function nav(items){return `<nav class="tabs">${items.map(([k,l])=>`<button class="tab ${state.tab===k?'active':''}" data-tab="${k}">${l}</button>`).join('')}</nav>`;}
function bindTabs(){document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;renderApp();});const l=document.getElementById('logout');if(l)l.onclick=logout;const p=document.getElementById('changePw');if(p)p.onclick=changePassword;}
async function renderApp(){if(profile.role==='teacher')return renderTeacher();return renderStudent();}
async function renderTeacher(){const [q,t,s,r]=await Promise.all([sb.from('questions').select('id,subject,chapter,topic,source_name,source_question_number,question_text,marks,negative_marks,created_at').eq('is_active',true).order('created_at',{ascending:false}),sb.from('tests').select('id,title,duration_minutes,default_negative_marks,is_published,created_at').order('created_at',{ascending:false}),sb.from('profiles').select('id,user_code,full_name,role').eq('role','student').order('full_name'),sb.from('teacher_attempt_report').select('*').order('submitted_at',{ascending:false})]);state.teacher.questions=q.data||[];state.teacher.tests=t.data||[];state.teacher.students=s.data||[];state.teacher.reports=r.data||[];let body=nav([['dashboard','Dashboard'],['questions','Question Bank'],['import','Import Questions'],['tests','Create Test'],['students','Students'],['reports','Performance'],['account','My Account']]);if(state.tab==='dashboard')body+=teacherDashboard();if(state.tab==='questions')body+=teacherQuestions();if(state.tab==='import')body+=teacherImport();if(state.tab==='tests')body+=teacherTests();if(state.tab==='students')body+=teacherStudents();if(state.tab==='reports')body+=teacherReports();if(state.tab==='account')body+=accountPanel();app.innerHTML=shell('Teacher Dashboard',`Welcome, ${profile.full_name||'Teacher'} · ${profile.user_code||'T001'}`,body,btn('Logout','logout','secondary'));bindTabs();bindTeacher();}
function teacherDashboard(){return `<section class="stats"><div class="card stat"><div class="muted">Questions</div><strong>${state.teacher.questions.length}</strong></div><div class="card stat"><div class="muted">Tests</div><strong>${state.teacher.tests.length}</strong></div><div class="card stat"><div class="muted">Students</div><strong>${state.teacher.students.length}</strong></div><div class="card stat"><div class="muted">Submitted Attempts</div><strong>${state.teacher.reports.length}</strong></div></section><section class="card"><h2>Teacher Control Center</h2><div class="grid2"><div><b>1.</b> Import or add questions</div><div><b>2.</b> Verify private answer keys</div><div><b>3.</b> Create 180–300+ question tests</div><div><b>4.</b> Assign tests to students</div><div><b>5.</b> Monitor detailed performance</div><div><b>6.</b> Keep every attempt recorded</div></div><div class="notice top16">The production question bank starts with <b>0 questions</b>. Only teacher-added/imported questions become part of the system.</div></section>`;}
function teacherQuestions(){return `<section class="card"><div class="section-title"><div><h2>Question Bank</h2><p class="muted">Search, review and organize the complete question bank.</p></div><button class="btn primary" data-tab="import">Import Questions</button></div><div class="toolbar"><input id="qSearch" placeholder="Search question / subject / chapter / topic / source"></div><div id="qTable" class="table-wrap"></div></section>`;}
function renderQuestionTable(filter=''){const rows=state.teacher.questions.filter(q=>[q.question_text,q.subject,q.chapter,q.topic,q.source_name,q.source_question_number].join(' ').toLowerCase().includes(filter.toLowerCase()));return `<table><thead><tr><th>No.</th><th>Subject</th><th>Chapter</th><th>Topic</th><th>Source</th><th>Question</th><th>Status</th><th>Manage</th></tr></thead><tbody>${rows.map(q=>`<tr><td>${esc(q.source_question_number||'—')}</td><td>${esc(q.subject)}</td><td>${esc(q.chapter||'')}</td><td>${esc(q.topic||'')}</td><td>${esc(q.source_name||'')}</td><td>${esc(q.question_text)}</td><td><span class="badge good">Stored</span></td><td><button class="btn danger sm" data-delete-question="${q.id}">Delete</button></td></tr>`).join('')||`<tr><td colspan="8">${empty('No questions found.')}</td></tr>`}</tbody></table>`;}
async function deleteQuestion(questionId){const q=state.teacher.questions.find(x=>x.id===questionId);if(!q)return;if(!confirm(`Delete this question?\n\n${q.question_text}\n\nThis cannot be undone.`))return;const {error}=await sb.from('questions').delete().eq('id',questionId);if(error){alert(`Could not delete the question.\n\n${error.message}`);return;}state.teacher.questions=state.teacher.questions.filter(x=>x.id!==questionId);const box=document.getElementById('qTable');const search=document.getElementById('qSearch');if(box)box.innerHTML=renderQuestionTable(search?.value||'');const stat=document.querySelector('.stat strong');if(stat&&state.teacher.questions){}await refreshTeacherData();}
function teacherImport(){return `<section class="card"><h2>Import Questions</h2><p class="muted">Ma’am can upload a question file plus a separate answer key. The answer key is used only for grading and teacher reporting.</p><div class="grid2"><label>Question file<input id="qFile" type="file" accept=".pdf,.docx,.xlsx,.xls,.csv,.txt"></label><label>Answer key<input id="aFile" type="file" accept=".pdf,.docx,.xlsx,.xls,.csv,.txt"></label><label>Subject<input id="impSubject" placeholder="e.g. Biology"></label><label>Class / Exam<input id="impExam" placeholder="e.g. NCERT Class XI"></label><label>Chapter<input id="impChapter" placeholder="Optional"></label><label>Topic<input id="impTopic" placeholder="Optional"></label></div><div class="row gap top16"><button class="btn primary" id="previewImport">Preview Questions</button><button class="btn secondary" id="clearImport">Clear</button></div><div id="importPreview" class="top16"></div></section>`;}
async function bindTeacher(){document.getElementById('qSearch')?.addEventListener('input',e=>{const box=document.getElementById('qTable');if(box)box.innerHTML=renderQuestionTable(e.target.value);});const qt=document.getElementById('qTable');if(qt)qt.innerHTML=renderQuestionTable();document.querySelectorAll('[data-delete-question]').forEach(b=>b.addEventListener('click',()=>deleteQuestion(b.dataset.deleteQuestion)));document.getElementById('previewImport')?.addEventListener('click',previewImport);document.getElementById('clearImport')?.addEventListener('click',()=>renderApp());document.getElementById('createTest')?.addEventListener('click',createTest);}
function teacherTests(){const qs=state.teacher.questions;const students=state.teacher.students;return `<section class="card"><h2>Create & Assign Test</h2>${students.length?`<div class="grid2"><label>Test title<input id="tTitle" placeholder="Biology Test 01"></label><label>Duration (minutes)<input id="tDuration" type="number" min="1" value="180"></label><label>Default marks per question<input id="tMarks" type="number" min="0" step="0.25" value="1"></label><label>Negative marks per wrong answer<input id="tNeg" type="number" min="0" step="0.25" value="0"></label><label>Assign to students<select id="tStudents" multiple size="4">${students.map(s=>`<option value="${s.id}">${esc(s.full_name||'Student')} · ${esc(s.user_code||'')}</option>`).join('')}</select></label><label>Instructions<textarea id="tInstructions" placeholder="Test instructions"></textarea></label></div><h3 class="top20">Select Questions (${qs.length} available)</h3><div class="pick-list">${qs.map((q,i)=>`<label class="pick"><input class="tq" type="checkbox" value="${q.id}"><span><b>${i+1}.</b> ${esc(q.question_text)}</span></label>`).join('')||empty('Add questions before creating a test.')}</div><div class="row gap top16"><button class="btn primary" id="createTest">Create Test & Assign</button></div><p id="testMsg" class="muted"></p>`:`<div class="notice">No students are available yet. Create/approve a student Auth account and set its profile role to <b>student</b>.</div>`}</section>`;}
function teacherStudents(){return `<section class="card"><h2>Students</h2><p class="muted">Only student profiles in this project appear here.</p><div class="table-wrap"><table><thead><tr><th>Student ID</th><th>Name</th><th>Role</th></tr></thead><tbody>${state.teacher.students.map(s=>`<tr><td>${esc(s.user_code||'')}</td><td>${esc(s.full_name||'')}</td><td>${esc(s.role)}</td></tr>`).join('')||`<tr><td colspan="3">${empty('No students found.')}</td></tr>`}</tbody></table></div></section>`;}
function teacherReports(){const r=state.teacher.reports;return `<section class="card"><h2>Performance Reports</h2><div class="table-wrap"><table><thead><tr><th>Student</th><th>Test</th><th>Score</th><th>Correct</th><th>Wrong</th><th>Skipped</th><th>Accuracy</th><th>Submitted</th></tr></thead><tbody>${r.map(x=>`<tr><td>${esc(x.student_name||'')} · ${esc(x.student_code||'')}</td><td>${esc(x.test_title||'')}</td><td>${money(x.score)}</td><td>${x.correct_count}</td><td>${x.wrong_count}</td><td>${x.skipped_count}</td><td>${money(x.accuracy)}%</td><td>${fmt(x.submitted_at)}</td></tr>`).join('')||`<tr><td colspan="8">${empty('No completed attempts yet.')}</td></tr>`}</tbody></table></div></section>`;}
function accountPanel(){return `<section class="card login-card" style="margin:18px 0 0 0"><h2>My Account</h2><p class="muted">Teacher ID: <b>${esc(profile.user_code||'T001')}</b></p><label>New password<input id="newPw" type="password" placeholder="At least 6 characters"></label><button id="savePw" class="btn primary top16">Change Password</button><p id="pwMsg" class="muted"></p></section>`;}
async function changePassword(){const box=app.querySelector('#newPw');if(!box)return;const p=prompt('Enter new password (minimum 6 characters):');if(!p)return;if(p.length<6){alert('Password must be at least 6 characters.');return;}const {error}=await sb.auth.updateUser({password:p});alert(error?error.message:'Password changed successfully.');}
async function createTest(){const title=document.getElementById('tTitle').value.trim(),duration=Number(document.getElementById('tDuration').value),marks=Number(document.getElementById('tMarks').value),neg=Number(document.getElementById('tNeg').value),instructions=document.getElementById('tInstructions').value.trim(),students=[...document.getElementById('tStudents').selectedOptions].map(o=>o.value),qids=[...document.querySelectorAll('.tq:checked')].map(x=>x.value),msg=document.getElementById('testMsg');if(!title||!duration||!qids.length||!students.length){msg.textContent='Enter test details, select at least one student and select questions.';return;}msg.textContent='Creating test…';const ins=await sb.from('tests').insert({title,description:instructions,duration_minutes:duration,default_marks:marks,default_negative_marks:neg,is_published:true,created_by:profile.id}).select('id').single();if(ins.error){msg.textContent=ins.error.message;return;}const tq=qids.map((question_id,i)=>({test_id:ins.data.id,question_id,question_order:i+1,marks,negative_marks:neg}));const tqr=await sb.from('test_questions').insert(tq);if(tqr.error){await sb.from('tests').delete().eq('id',ins.data.id);msg.textContent=tqr.error.message;return;}const as=students.map(student_id=>({test_id:ins.data.id,student_id,assigned_by:profile.id,status:'assigned'}));const ar=await sb.from('test_assignments').insert(as);if(ar.error){msg.textContent=ar.error.message;return;}msg.textContent=`Test created and assigned to ${students.length} student(s).`;await renderTeacher();}
async function previewImport(){const qf=document.getElementById('qFile').files[0],af=document.getElementById('aFile').files[0],box=document.getElementById('importPreview');if(!qf){box.innerHTML='<div class="notice">Choose a question file first.</div>';return;}box.innerHTML='<div class="notice">Reading files…</div>';try{const qt=await readFile(qf),at=af?await readFile(af):'';const items=parseQuestions(qt,at);if(!items.length){box.innerHTML='<div class="notice">No structured questions were detected. Use a clean PDF/DOCX or a text/CSV/XLSX file where each question has four options.</div>';return;}window.__importItems={items,qf};box.innerHTML=`<div class="success">Detected <b>${items.length}</b> question(s). Review the preview below.</div><div class="table-wrap"><table><thead><tr><th>#</th><th>Question</th><th>Options</th><th>Answer</th></tr></thead><tbody>${items.slice(0,80).map(x=>`<tr><td>${esc(x.number)}</td><td>${esc(x.question)}</td><td>${x.options.map((o,i)=>`${String.fromCharCode(65+i)}. ${esc(o)}`).join('<br>')}</td><td>${x.correct_option||'Review pending'}</td></tr>`).join('')}</tbody></table></div><div class="row gap top16"><button id="importNow" class="btn primary">Import ${items.length} Questions</button></div>`;document.getElementById('importNow').onclick=importNow;}catch(e){box.innerHTML=`<div class="error">${esc(e.message)}</div>`;}}
async function importNow(){const {items,qf}=window.__importItems||{};if(!items)return;const base={subject:document.getElementById('impSubject').value.trim(),exam_name:document.getElementById('impExam').value.trim(),chapter:document.getElementById('impChapter').value.trim(),topic:document.getElementById('impTopic').value.trim(),source_name:qf.name};if(!base.subject){alert('Please enter Subject.');return;}let saved=0;try{for(const x of items){if(!x.correct_option)continue;const ins=await sb.from('questions').insert({subject:base.subject,class_name:base.exam_name,exam_name:base.exam_name,chapter:base.chapter,topic:base.topic,source_name:base.source_name,source_question_number:String(x.number||''),question_text:x.question,option_a:x.options[0],option_b:x.options[1],option_c:x.options[2],option_d:x.options[3],marks:1,negative_marks:0,is_active:true,created_by:profile.id}).select('id').single();if(ins.error)throw new Error(ins.error.message);const ar=await sb.from('question_answers').insert({question_id:ins.data.id,correct_option:x.correct_option,explanation:x.explanation||''});if(ar.error)throw new Error(ar.error.message);saved++;}document.getElementById('importPreview').innerHTML=`<div class="success">Imported <b>${saved}</b> verified question(s). Questions without a detected answer were not imported.</div>`;delete window.__importItems;await renderTeacher();}catch(e){document.getElementById('importPreview').innerHTML=`<div class="error">Import stopped: ${esc(e.message)}. ${saved} question(s) were saved before the error.</div>`;}}
async function readFile(file){
  const ext=file.name.toLowerCase().split('.').pop();
  if(ext==='txt'||ext==='csv') return await file.text();
  if(ext==='docx'){
    const b=await file.arrayBuffer();
    return (await window.mammoth.extractRawText({arrayBuffer:b})).value;
  }
  if(ext==='xlsx'||ext==='xls'){
    const b=await file.arrayBuffer(),wb=XLSX.read(b,{type:'array'});
    return wb.SheetNames.map(n=>XLSX.utils.sheet_to_csv(wb.Sheets[n])).join('\n');
  }
  if(ext==='pdf'){
    if(!window.pdfjsLib) throw new Error('PDF reader is not loaded. Refresh the page and try again.');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const data=new Uint8Array(await file.arrayBuffer());
    const pdf=await window.pdfjsLib.getDocument({data}).promise;
    let out='';
    for(let pageNo=1; pageNo<=pdf.numPages; pageNo++){
      const page=await pdf.getPage(pageNo);
      const tc=await page.getTextContent();
      const items=tc.items.map(it=>({
        str:String(it.str||''),
        x:Number(it.transform?.[4]||0),
        y:Number(it.transform?.[5]||0),
        h:Number(it.height||0)
      })).filter(it=>it.str.trim());
      // Reconstruct readable lines from positioned PDF text items.
      const rows=[];
      for(const item of items){
        let row=rows.find(r=>Math.abs(r.y-item.y)<=3);
        if(!row){row={y:item.y,items:[]};rows.push(row);}
        row.items.push(item);
      }
      rows.sort((a,b)=>b.y-a.y);
      for(const row of rows){
        row.items.sort((a,b)=>a.x-b.x);
        const line=row.items.map(x=>x.str).join(' ').replace(/\s+/g,' ').trim();
        if(line) out+=line+'\n';
      }
      out+='\n';
    }
    return out;
  }
  throw new Error('Unsupported file type');
}
function normalizeAnswer(value){
  const s=String(value||'').trim().toUpperCase();
  if(/^[1-4]$/.test(s)) return 'ABCD'[Number(s)-1];
  if(/^[A-D]$/.test(s)) return s;
  return null;
}
function parseAnswerKey(answerText=''){
  const text=String(answerText||'').replace(/\r/g,'');
  const lines=text.split(/\n+/).map(s=>s.trim()).filter(Boolean);
  const ans={};
  for(let i=0;i<lines.length;i++){
    const qmatch=lines[i].match(/^(?:QUES|QUE|QUESTIONS?)\s+(.+)$/i);
    if(!qmatch) continue;
    const nums=(qmatch[1].match(/\d+/g)||[]).map(Number);
    const amatch=(lines[i+1]||'').match(/^ANS(?:WERS?|WER)?\s+(.+)$/i);
    if(amatch){
      const vals=(amatch[1].match(/[A-D1-4]/gi)||[]).map(normalizeAnswer).filter(Boolean);
      for(let k=0;k<Math.min(nums.length,vals.length);k++) ans[nums[k]]=vals[k];
      i++;
    }
  }
  // Supports: 91 B / Q91 B / Question 91: B / 91. B
  for(const m of text.matchAll(/(?:^|\n)\s*(?:Q(?:UES|UESTION)?\.?\s*)?(\d+)\s*[:.)-]?\s*([A-D1-4])\b/gim)){
    const a=normalizeAnswer(m[2]);
    if(a) ans[Number(m[1])]=a;
  }
  // Supports: Que. 1 Ans. 2
  for(const m of text.matchAll(/(?:QUE|Q|QUESTION)\.?\s*(\d+)\s*(?:[:.)-]?\s*)?(?:ANS|ANSWER)\.?\s*[:.)-]?\s*([A-D1-4])/gi)){
    const a=normalizeAnswer(m[2]);
    if(a) ans[Number(m[1])]=a;
  }
  return ans;
}
function parseQuestions(text,answerText=''){
  const lines=String(text||'').replace(/\r/g,'').split(/\n+/).map(s=>s.trim()).filter(Boolean);
  const ans=parseAnswerKey(answerText);
  const out=[];
  let i=0;
  while(i<lines.length){
    const qm=lines[i].match(/^(\d+)\.\s+(.+)/);
    if(!qm){i++;continue;}
    const number=Number(qm[1]);
    let question=qm[2];
    i++;
    const opts=[];
    while(i<lines.length){
      const line=lines[i];
      // Accept both (A) text / A. text and (1) text / 1. text.
      const om=line.match(/^\(?([A-D1-4])\)?\s*(?:[.:-])\s*(.+)$/i);
      if(om){
        const key=om[1].toUpperCase();
        const idx=/^[1-4]$/.test(key)?Number(key)-1:'ABCD'.indexOf(key);
        if(idx>=0) opts[idx]=om[2].trim();
        i++;
        continue;
      }
      // Some PDFs use (A) without punctuation after the option marker.
      const om2=line.match(/^\(?([A-D])\)\s+(.+)$/i);
      if(om2){
        const idx='ABCD'.indexOf(om2[1].toUpperCase());
        if(idx>=0) opts[idx]=om2[2].trim();
        i++;
        continue;
      }
      if(/^\d+\.\s+/.test(line)) break;
      if(/^(?:ANSWERS? KEY|QUES\s+\d+|ANS\s+[A-D1-4])/i.test(line)) break;
      question+=' '+line;
      i++;
    }
    const clean=opts.slice(0,4).map(v=>String(v||'').trim());
    if(clean.length===4 && clean.every(Boolean)){
      out.push({number,question:question.trim(),options:clean,correct_option:ans[number]||null});
    }
  }
  return out;
}
async function renderStudent(){const {data:tests}=await sb.rpc('get_student_tests');const {data:prog}=await sb.from('my_progress').select('*').order('submitted_at',{ascending:false});state.student.tests=tests||[];state.student.progress=prog||[];let body=nav([['dashboard','Dashboard'],['tests','My Tests'],['progress','My Progress'],['account','My Account']]);if(state.tab==='dashboard')body+=studentDashboard();if(state.tab==='tests')body+=studentTests();if(state.tab==='progress')body+=studentProgress();if(state.tab==='account')body+=accountPanel();if(state.tab==='exam')return renderExam();app.innerHTML=shell('Student Dashboard',`Welcome, ${profile.full_name||'Student'} · ${profile.user_code||'S001'}`,body,btn('Logout','logout','secondary'));bindTabs();document.querySelectorAll('[data-start]').forEach(b=>b.onclick=()=>startTest(b.dataset.start));}
function studentDashboard(){const p=state.student.progress,correct=p.reduce((a,x)=>a+(x.correct_count||0),0),wrong=p.reduce((a,x)=>a+(x.wrong_count||0),0),skipped=p.reduce((a,x)=>a+(x.skipped_count||0),0),attempted=correct+wrong,acc=attempted?((correct/attempted)*100):0;return `<section class="stats"><div class="card stat"><div class="muted">Tests Taken</div><strong>${p.length}</strong></div><div class="card stat"><div class="muted">Correct</div><strong>${correct}</strong></div><div class="card stat"><div class="muted">Wrong</div><strong>${wrong}</strong></div><div class="card stat"><div class="muted">Accuracy</div><strong>${acc.toFixed(1)}%</strong></div></section><section class="card"><h2>My Progress</h2><p class="muted">Your dashboard shows only your own history and performance.</p><div class="progressbar"><span style="width:${Math.min(100,acc)}%"></span></div><p class="small muted top16">Total skipped: ${skipped}</p></section>`;}
function studentTests(){return `<section class="card"><h2>Assigned Tests</h2>${state.student.tests.map(t=>`<div class="card"><div class="section-title"><div><h3>${esc(t.title)}</h3><p class="muted">${t.question_count} questions · ${t.duration_minutes} minutes</p></div><button class="btn primary" data-start="${t.id}">${t.completed?'View Report':'Start Test'}</button></div>${t.completed?`<p class="small muted">Completed on ${fmt(t.submitted_at)}</p>`:''}</div>`).join('')||empty('No tests assigned yet.')}</section>`;}
function studentProgress(){return `<section class="card"><h2>Past Tests & Progress</h2><div class="table-wrap"><table><thead><tr><th>Test</th><th>Score</th><th>Correct</th><th>Wrong</th><th>Skipped</th><th>Accuracy</th><th>Date</th></tr></thead><tbody>${state.student.progress.map(x=>`<tr><td>${esc(x.test_title)}</td><td>${money(x.score)}</td><td>${x.correct_count}</td><td>${x.wrong_count}</td><td>${x.skipped_count}</td><td>${money(x.accuracy)}%</td><td>${fmt(x.submitted_at)}</td></tr>`).join('')||`<tr><td colspan="7">${empty('No completed tests yet.')}</td></tr>`}</tbody></table></div></section>`;}
async function startTest(testId){const {data:existing}=await sb.from('attempts').select('id,started_at,submitted_at').eq('test_id',testId).eq('student_id',profile.id).is('submitted_at',null).maybeSingle();let attempt=existing;if(!attempt){const ins=await sb.from('attempts').insert({assignment_id:(await sb.from('test_assignments').select('id').eq('test_id',testId).eq('student_id',profile.id).single()).data.id,student_id:profile.id,test_id:testId,total_questions:0}).select('id,started_at').single();if(ins.error){alert(ins.error.message);return;}attempt=ins.data;}const {data:qs,error}=await sb.rpc('get_student_test_questions',{p_test_id:testId});if(error){alert(error.message);return;}const {data:t}=await sb.from('tests').select('id,title,duration_minutes').eq('id',testId).single();if(!t){alert('Test not found');return;}const {data:saved}=await sb.from('attempt_answers').select('question_id,selected_option,marked_for_review').eq('attempt_id',attempt.id);const answers={},marked={};for(const x of saved||[]){if(x.selected_option)answers[x.question_id]=x.selected_option;marked[x.question_id]=!!x.marked_for_review;}state.attempt={id:attempt.id,testId,title:t.title,duration:t.duration_minutes,questions:qs||[],index:0,answers,marked,startedAt:attempt.started_at};state.tab='exam';renderExam();}
function palette(a){return `<div class="palette">${a.questions.map((q,i)=>`<button class="qnum ${a.answers[q.id]?'answered':''} ${a.marked[q.id]?'review':''} ${i===a.index?'current':''}" data-i="${i}">${i+1}</button>`).join('')}</div>`;}
function renderExam(){clearInterval(timer);const a=state.attempt;if(!a)return renderStudent();const q=a.questions[a.index];const body=`<div class="exam-head"><div><b>${esc(a.title)}</b><div class="muted">Question ${a.index+1} of ${a.questions.length}</div></div><div id="timer" class="timer">--:--</div></div><div class="exam-grid"><section class="card"><div class="question-text">${esc(q.question)}</div><div class="options">${q.options.map((o,i)=>{const l=String.fromCharCode(65+i);return `<label class="option ${a.answers[q.id]===l?'selected':''}"><input type="radio" name="answer" value="${l}" ${a.answers[q.id]===l?'checked':''}><span><b>${l}.</b> ${esc(o)}</span></label>`;}).join('')}</div><div class="row gap top20"><button class="btn secondary" id="prev" ${a.index===0?'disabled':''}>Previous</button><button class="btn secondary" id="clear">Clear Response</button><button class="btn warn" id="mark">${a.marked[q.id]?'Unmark Review':'Mark for Review'}</button><button class="btn primary" id="next">${a.index===a.questions.length-1?'Submit Test':'Save & Next'}</button></div></section><aside class="card"><h3>Question Palette</h3>${palette(a)}<div class="legend"><span class="badge good">Answered</span><span class="badge warn">Review</span></div></aside></div>`;app.innerHTML=`<header class="topbar"><div class="brand">RUDRAKSH CBT EXAMINATION</div><div>${btn('Submit Test','examSubmit','danger')}</div></header><main class="container">${body}</main>`;document.querySelectorAll('[name="answer"]').forEach(r=>r.onchange=()=>saveAnswer(q.id,r.value,a.marked[q.id]||false));document.getElementById('prev').onclick=()=>{a.index--;renderExam();};document.getElementById('clear').onclick=()=>saveAnswer(q.id,null,a.marked[q.id]||false);document.getElementById('mark').onclick=async()=>{a.marked[q.id]=!a.marked[q.id];await syncAnswer(q.id);renderExam();};document.getElementById('next').onclick=()=>a.index===a.questions.length-1?submitExam(false):(a.index++,renderExam());document.getElementById('examSubmit').onclick=()=>submitExam(false);document.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>{a.index=Number(b.dataset.i);renderExam();});timer=setInterval(()=>updateTimer(a),1000);updateTimer(a);}
async function syncAnswer(qid){const a=state.attempt;await sb.from('attempt_answers').upsert({attempt_id:a.id,question_id:qid,selected_option:a.answers[qid]||null,marked_for_review:!!a.marked[qid],answered_at:a.answers[qid]?new Date().toISOString():null},{onConflict:'attempt_id,question_id'});}
async function saveAnswer(qid,val,review){const a=state.attempt;if(val)a.answers[qid]=val;else delete a.answers[qid];a.marked[qid]=!!review;await syncAnswer(qid);renderExam();}
function updateTimer(a){const total=a.duration*60000,left=Math.max(0,total-(Date.now()-new Date(a.startedAt).getTime())),m=Math.floor(left/60000),s=Math.floor(left/1000)%60;const el=document.getElementById('timer');if(el)el.textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;if(left<=0){clearInterval(timer);submitExam(true);}}
async function submitExam(auto){if(!state.attempt)return;const {data,error}=await sb.rpc('submit_attempt',{p_attempt_id:state.attempt.id});if(error){alert(error.message);return;}clearInterval(timer);const r=data?.[0]||data;state.attempt=null;state.tab='progress';alert(auto?'Time expired. Test auto-submitted.':`Test submitted. Score: ${r?.score??'saved'}`);renderStudent();}
boot();
