'use strict';

const $ = (id) => document.getElementById(id);
const STORE = {
  users: 'postop_users', patients: 'postop_patients', checkins: 'postop_checkins_',
  wound: 'postop_wound_', meds: 'postop_medications_'
};
let selectedRole = 'doctor';
let authMode = 'login';
let currentUser = null;
let currentScreen = 'Patient Dashboard';
let selectedPatientId = null;
let lastUploadedPhoto = '';
let toastTimer = null;

const SCREEN_PURPOSE = {
  'Login & Registration': 'Allows patients and doctors to securely access the Post-Op Care system using their assigned account.',
  'Patient Dashboard': 'Gives the patient a quick overview of recovery progress, recent health readings, medications, and important alerts.',
  'Daily Check-in': 'Allows the patient to submit daily symptoms and health readings so the doctor can monitor recovery remotely.',
  'Medication & Wound Care': 'Helps the patient review prescribed medications, track doses, and submit wound photos for follow-up.',
  'Doctor Dashboard': 'Provides the doctor with a summary of assigned patients, urgent alerts, and cases that need follow-up.',
  'Patient Details & Reports': "Allows the doctor to review a patient's medical record, recovery history, wound updates, and generate a follow-up report.",
  'Messages': 'Secure-style demonstration conversation between the patient and their assigned doctor.'
};

function readStore(key, fallback) {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; }
  catch { return fallback; }
}
function writeStore(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { showToast('Browser storage is full. Please remove an old wound photo and try again.'); return false; }
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function normalizeSex(value) {
  return ['Male', 'Female', 'Not Specified'].includes(value) ? value : 'Not Specified';
}
function initials(name) {
  return String(name || 'User').trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase();
}
function todayLabel() {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date());
}
function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2700);
}
function newId(prefix) { return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random()*900+100)}`; }

function initializeDemoData() {
  let users = readStore(STORE.users, []);
  if (!Array.isArray(users)) users = [];
  const doctor = users.find(u => String(u.email).toLowerCase() === 'doctor@postopcare.com');
  if (doctor) { doctor.name = 'Dr. Ahmed Rabie'; doctor.role = 'doctor'; doctor.inviteCode = doctor.inviteCode || 'AHMED123'; }
  else users.push({ name: 'Dr. Ahmed Rabie', email: 'doctor@postopcare.com', password: '123456', role: 'doctor', phone: '01000000000', inviteCode: 'AHMED123' });
  const patientAccount = users.find(u => String(u.email).toLowerCase() === 'patient@postopcare.com');
  if (!patientAccount) users.push({ name: 'Ahmed Mohamed', email: 'patient@postopcare.com', password: '123456', role: 'patient', phone: '01012345678', sex: 'Not Specified', surgery: 'Appendectomy', surgeryDate: '2026-10-28' });
  writeStore(STORE.users, users);

  let patients = readStore(STORE.patients, []);
  if (!Array.isArray(patients) || patients.length === 0) {
    patients = [
      { id:'PO-1001', name:'Ahmed Mohamed', email:'patient@postopcare.com', phone:'01012345678', sex:'Not Specified', procedure:'Appendectomy', surgeryDate:'2026-10-28', progress:75, status:'Recovering well', nextAppointment:'Nov 06, 2026', needsFollowup:false, reviewed:false, assignedDoctor:'Dr. Ahmed Rabie', assignedDoctorEmail:'doctor@postopcare.com' },
      { id:'PO-1002', name:'Sara Ali', email:'sara.ali@postopcare.com', phone:'01098765432', sex:'Not Specified', procedure:'Knee replacement', surgeryDate:'2026-10-26', progress:58, status:'Needs follow-up', nextAppointment:'Nov 03, 2026', needsFollowup:true, followUpMessage:'Patient reported increased pain. Please review the latest recovery update.', reviewed:false, assignedDoctor:'Dr. Ahmed Rabie', assignedDoctorEmail:'doctor@postopcare.com' },
      { id:'PO-1003', name:'Mohamed Hassan', email:'m.hassan@postopcare.com', phone:'01123456789', sex:'Not Specified', procedure:'Hernia repair', surgeryDate:'2026-10-24', progress:82, status:'On track', nextAppointment:'Nov 08, 2026', needsFollowup:false, reviewed:false, assignedDoctor:'Dr. Ahmed Rabie', assignedDoctorEmail:'doctor@postopcare.com' },
      { id:'PO-1004', name:'Mariam Adel', email:'mariam.adel@postopcare.com', phone:'01234567890', sex:'Not Specified', procedure:'Gallbladder surgery', surgeryDate:'2026-10-30', progress:42, status:'Under monitoring', nextAppointment:'Nov 04, 2026', needsFollowup:false, reviewed:false, assignedDoctor:'Dr. Ahmed Rabie', assignedDoctorEmail:'doctor@postopcare.com' }
    ];
    writeStore(STORE.patients, patients);
  }
  // Add a backwards-compatible value for patient records created before the Sex field existed.
  patients.forEach(patient => { patient.sex = normalizeSex(patient.sex); if (!patient.assignedDoctorEmail && patient.assignedDoctor === 'Dr. Ahmed Rabie') patient.assignedDoctorEmail = 'doctor@postopcare.com'; });
  savePatients(patients);
  users.forEach(user => { if (user.role === 'patient') { user.sex = normalizeSex(user.sex); if (user.email === 'patient@postopcare.com' && !user.assignedDoctorEmail) user.assignedDoctorEmail = 'doctor@postopcare.com'; } });
  writeStore(STORE.users, users);
  // Make sure every patient can be selected and opened even when using a fresh browser.
  patients.forEach(p => {
    if (!users.some(u => String(u.email).toLowerCase() === String(p.email).toLowerCase())) {
      users.push({ name:p.name, email:p.email, password:'123456', role:'patient', phone:p.phone || '', sex:normalizeSex(p.sex), surgery:p.procedure || '', surgeryDate:p.surgeryDate || '' });
    }
  });
  writeStore(STORE.users, users);

  // Seed a small demonstration history so the dashboards and doctor reports
  // are populated on first launch, without replacing any real demo entries.
  const demoHistory = {
    'patient@postopcare.com': [{ id:'CHK-DEMO-1001', date:'Nov 02, 2026, 09:00 AM', pain:2, temperature:'36.8', heartRate:72, oxygen:98, wound:'Looks good', flags:'', notes:'Mild discomfort around the incision. Otherwise feeling well.' }],
    'sara.ali@postopcare.com': [{ id:'CHK-DEMO-1002', date:'Nov 02, 2026, 08:15 AM', pain:7, temperature:'37.2', heartRate:88, oxygen:97, wound:'Some redness', flags:'Pain', notes:'Pain increased around the incision site. Follow-up requested.' }],
    'm.hassan@postopcare.com': [{ id:'CHK-DEMO-1003', date:'Nov 01, 2026, 06:30 PM', pain:1, temperature:'36.7', heartRate:70, oxygen:99, wound:'Looks good', flags:'', notes:'Walking gently as advised.' }]
  };
  Object.entries(demoHistory).forEach(([email, history]) => {
    try { if (localStorage.getItem(STORE.checkins + email) === null) saveCheckins(email, history); } catch {}
  });
}

function getUsers() { return readStore(STORE.users, []); }
function saveUsers(users) { writeStore(STORE.users, users); }
function getPatients() { return readStore(STORE.patients, []); }
function getPatientsForDoctor(email = currentUser?.email) { return getPatients().filter(p => String(p.assignedDoctorEmail || '').toLowerCase() === String(email || '').toLowerCase()); }
function getAssignedDoctor(patient) { return getUsers().find(u => u.role === 'doctor' && String(u.email).toLowerCase() === String(patient?.assignedDoctorEmail || '').toLowerCase()); }
function savePatients(patients) { writeStore(STORE.patients, patients); }
function currentPatient() { return getPatients().find(p => p.email.toLowerCase() === currentUser.email.toLowerCase()); }
function patientForEmail(email) { return getPatients().find(p => p.email.toLowerCase() === String(email).toLowerCase()); }
function getCheckins(email) { return readStore(STORE.checkins + email.toLowerCase(), []); }
function saveCheckins(email, items) { writeStore(STORE.checkins + email.toLowerCase(), items); }
function getMedicationState(email) { return readStore(STORE.meds + email.toLowerCase(), [true, false, false]); }
function saveMedicationState(email, state) { writeStore(STORE.meds + email.toLowerCase(), state); }
function getWoundPhoto(email) { try { return localStorage.getItem(STORE.wound + email.toLowerCase()) || ''; } catch { return ''; } }
function setWoundPhoto(email, data) { try { localStorage.setItem(STORE.wound + email.toLowerCase(), data); return true; } catch { showToast('Photo could not be saved. Try a smaller image.'); return false; } }

function setupAuth() {
  document.querySelectorAll('.role-choice').forEach(button => button.addEventListener('click', () => {
    selectedRole = button.dataset.role;
    document.querySelectorAll('.role-choice').forEach(item => item.classList.toggle('active', item === button));
    const demoEmail = selectedRole === 'doctor' ? 'doctor@postopcare.com' : 'patient@postopcare.com';
    const previousDemoEmail = selectedRole === 'doctor' ? 'patient@postopcare.com' : 'doctor@postopcare.com';
    if (!$('authEmail').value || $('authEmail').value.trim().toLowerCase() === previousDemoEmail) $('authEmail').value = demoEmail;
    $('authMessage').textContent = '';
    setAuthMode(authMode); // Refresh optional patient-only registration fields when the role changes.
  }));
  $('loginTab').addEventListener('click', () => setAuthMode('login'));
  $('registerTab').addEventListener('click', () => { if (selectedRole === 'doctor') { selectedRole = 'patient'; document.querySelectorAll('.role-choice').forEach(item => item.classList.toggle('active', item.dataset.role === 'patient')); $('authEmail').value = 'patient@postopcare.com'; } setAuthMode('register'); });
  $('togglePassword').addEventListener('click', () => {
    const field = $('authPassword');
    field.type = field.type === 'password' ? 'text' : 'password';
    $('togglePassword').textContent = field.type === 'password' ? 'Show' : 'Hide';
  });
  $('forgotButton').addEventListener('click', () => showToast('For this demo, use the password shown in the Demo accounts box.'));
  $('authForm').addEventListener('submit', handleAuthSubmit);
}
function setAuthMode(mode) {
  authMode = mode;
  const register = mode === 'register';
  $('nameField').hidden = !register;
  $('sexField').hidden = !(register && selectedRole === 'patient');
  ['phoneField','procedureField','surgeryDateField','doctorCodeField'].forEach(id => { if ($(id)) $(id).hidden = !(register && selectedRole === 'patient'); });
  ['patientPhone','patientProcedure','patientSurgeryDate','doctorInviteCode'].forEach(id => { if ($(id)) $(id).required = register && selectedRole === 'patient'; });
  $('confirmField').hidden = !register;
  $('authName').required = register;
  $('confirmPassword').required = register;
  $('rememberRow').hidden = register;
  $('loginTab').classList.toggle('active', !register);
  $('registerTab').classList.toggle('active', register);
  $('authTitle').textContent = register ? 'Create your account' : 'Welcome back!';
  $('authSubtitle').textContent = SCREEN_PURPOSE['Login & Registration'];
  $('authSubmit').innerHTML = register ? 'Create account <span>→</span>' : 'Login <span>→</span>';
  $('authPassword').autocomplete = register ? 'new-password' : 'current-password';
  $('authMessage').textContent = '';
}
function handleAuthSubmit(event) {
  event.preventDefault();
  const email = $('authEmail').value.trim().toLowerCase();
  const password = $('authPassword').value;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { $('authMessage').textContent = 'Please enter a valid email address.'; return; }
  if (password.length < 6) { $('authMessage').textContent = 'Password must contain at least 6 characters.'; return; }
  let users = getUsers();
  if (authMode === 'register') {
    if (selectedRole === 'doctor') { $('authMessage').textContent = 'Doctor accounts are created by the system administrator. Please sign in with an assigned doctor account.'; return; }
    const name = $('authName').value.trim();
    if (!name) { $('authMessage').textContent = 'Please enter your full name.'; return; }
    if (password !== $('confirmPassword').value) { $('authMessage').textContent = 'The passwords do not match.'; return; }
    if (users.some(u => String(u.email).toLowerCase() === email)) { $('authMessage').textContent = 'An account with this email already exists.'; return; }
    const sex = normalizeSex($('patientSex').value);
    const phone = $('patientPhone').value.trim();
    const surgery = $('patientProcedure').value.trim();
    const surgeryDate = $('patientSurgeryDate').value;
    const inviteCode = $('doctorInviteCode').value.trim().toUpperCase();
    const assignedDoctor = users.find(u => u.role === 'doctor' && String(u.inviteCode || '').toUpperCase() === inviteCode);
    if (!phone || !surgery || !surgeryDate || !inviteCode) { $('authMessage').textContent = 'Please complete your phone, surgery details, surgery date, and doctor invitation code.'; return; }
    if (!assignedDoctor) { $('authMessage').textContent = 'Doctor invitation code not found. Please check the code provided by your doctor.'; return; }
    const user = { name, email, password, role:'patient', phone, sex, surgery, surgeryDate, assignedDoctorEmail:assignedDoctor.email };
    users.push(user); saveUsers(users);
    const patients = getPatients();
    patients.unshift({ id:newId('PO'), name, email, phone, sex, procedure:surgery, surgeryDate, progress:0, status:'New patient · Awaiting doctor review', nextAppointment:'To be scheduled', needsFollowup:false, reviewed:false, assignedDoctor:assignedDoctor.name, assignedDoctorEmail:assignedDoctor.email, registrationDate:new Date().toISOString() });
    savePatients(patients);
    currentUser = user;
    openWorkspace();
    showToast('Your account has been created successfully.');
  } else {
    const user = users.find(u => String(u.email).toLowerCase() === email && u.password === password && u.role === selectedRole);
    if (!user) { $('authMessage').textContent = 'Email, password, or account type is incorrect.'; return; }
    if (email === 'doctor@postopcare.com' && user.role === 'doctor') {
      user.name = 'Dr. Ahmed Rabie'; saveUsers(users);
    }
    try {
      if ($('rememberMe').checked) localStorage.setItem('postop_remembered_email', email);
      else localStorage.removeItem('postop_remembered_email');
    } catch {}
    currentUser = user;
    // Ensure a registered patient always has a row in the doctor workspace.
    if (user.role === 'patient' && !patientForEmail(user.email)) {
      const patients = getPatients();
      patients.push({ id:newId('PO'), name:user.name, email:user.email, phone:user.phone || '', sex:normalizeSex(user.sex), procedure:user.surgery || 'Post-operative recovery', surgeryDate:user.surgeryDate || '', progress:20, status:'Under monitoring', nextAppointment:'To be scheduled', needsFollowup:false, reviewed:false, assignedDoctor:getUsers().find(d => d.email === user.assignedDoctorEmail)?.name || 'Not assigned', assignedDoctorEmail:user.assignedDoctorEmail || '' });
      savePatients(patients);
    }
    openWorkspace();
    showToast('Signed in successfully.');
  }
}

function patientNavItems() {
  return [
    { name:'Patient Dashboard', icon:'⌂' },
    { name:'Daily Check-in', icon:'☷' },
    { name:'Medication & Wound Care', icon:'✚' },
    { name:'Messages', icon:'✉' }
  ];
}
function doctorNavItems() {
  return [
    { name:'Doctor Dashboard', icon:'▦' },
    { name:'Patient Details & Reports', icon:'▤' },
    { name:'Messages', icon:'✉' }
  ];
}
function navItems() { return currentUser?.role === 'doctor' ? doctorNavItems() : patientNavItems(); }
function renderNavigation() {
  const makeGroup = (title, items) => `<div class="nav-group"><div class="nav-group-title">${title}</div>${items.map(item => `<button type="button" class="nav-item ${currentScreen === item.name ? 'active' : ''}" data-screen="${escapeHtml(item.name)}" ${currentScreen === item.name ? 'aria-current="page"' : ''}><span class="nav-icon">${item.icon}</span><span>${escapeHtml(item.name)}</span></button>`).join('')}</div>`;
  $('sideNav').innerHTML = makeGroup(currentUser.role === 'doctor' ? 'DOCTOR WORKSPACE' : 'PATIENT WORKSPACE', navItems());
  $('sideNav').querySelectorAll('[data-screen]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.screen)));
}
function updateIdentity() {
  const name = currentUser.role === 'doctor' && currentUser.email.toLowerCase() === 'doctor@postopcare.com' ? 'Dr. Ahmed Rabie' : currentUser.name;
  currentUser.name = name;
  $('sideName').textContent = name;
  $('topName').textContent = name;
  $('sideRole').textContent = currentUser.role === 'doctor' ? 'Doctor · Healthcare professional' : 'Patient · Recovery journey';
  const avatarPath = currentUser.role === 'doctor' ? 'images/doctor-profile.jpg' : (currentUser.email.toLowerCase() === 'patient@postopcare.com' ? 'images/patient-profile.jpg' : '');
  const avatarAlt = currentUser.role === 'doctor' ? 'Dr. Ahmed Rabie profile photo' : 'Patient profile photo';
  const avatarMarkup = avatarPath ? `<img src="${avatarPath}" alt="${avatarAlt}">` : escapeHtml(initials(name));
  $('sideAvatar').innerHTML = avatarMarkup;
  $('topAvatar').innerHTML = avatarMarkup;
  $('sideAvatar').classList.toggle('has-photo', Boolean(avatarPath));
  $('topAvatar').classList.toggle('has-photo', Boolean(avatarPath));
  $('switchRoleButton').hidden = true;
}
function openWorkspace() {
  $('authView').hidden = true;
  $('appView').hidden = false;
  $('sidebar').classList.remove('open');
  updateIdentity();
  currentScreen = currentUser.role === 'doctor' ? 'Doctor Dashboard' : 'Patient Dashboard';
  if (currentUser.role === 'doctor') selectedPatientId = getPatientsForDoctor()[0]?.id || null;
  renderApp();
}
function navigate(screen) {
  const allowed = navItems().some(item => item.name === screen);
  if (!allowed) return;
  currentScreen = screen;
  $('sidebar').classList.remove('open');
  renderApp();
  $('pageContent').focus({preventScroll:true});
}
function logout() {
  currentUser = null;
  $('appView').hidden = true;
  $('authView').hidden = false;
  $('authForm').reset();
  const rememberedEmail = (() => { try { return localStorage.getItem('postop_remembered_email') || 'doctor@postopcare.com'; } catch { return 'doctor@postopcare.com'; } })();
  const rememberedUser = getUsers().find(user => String(user.email).toLowerCase() === rememberedEmail.toLowerCase());
  selectedRole = rememberedUser?.role || 'doctor';
  document.querySelectorAll('.role-choice').forEach(item => item.classList.toggle('active', item.dataset.role === selectedRole));
  setAuthMode('login');
  $('authEmail').value = rememberedEmail;
  $('authPassword').value = '';
}

function switchDemoRole() {
  if (!currentUser) return;
  const targetEmail = currentUser.role === 'doctor' ? 'patient@postopcare.com' : 'doctor@postopcare.com';
  const target = getUsers().find(user => String(user.email).toLowerCase() === targetEmail);
  if (!target) { showToast('The other demo account is not available.'); return; }
  currentUser = target;
  selectedPatientId = currentUser.role === 'doctor' ? (getPatientsForDoctor()[0]?.id || null) : null;
  openWorkspace();
  showToast(currentUser.role === 'doctor' ? 'Switched to Doctor Dashboard.' : 'Switched to Patient Dashboard.');
}

function heading(title, actions = '') {
  return `<div class="page-heading"><div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(SCREEN_PURPOSE[title] || '')}</p></div><div class="heading-actions">${actions}</div></div>`;
}
function statCard(label, value, icon, foot, color='') {
  return `<section class="stat-card"><div class="stat-top"><span>${escapeHtml(label)}</span><span class="stat-icon ${color}">${icon}</span></div><div class="stat-value">${escapeHtml(value)}</div><div class="stat-foot">${foot}</div></section>`;
}
function statusClass(patient) {
  const text = String(patient.status || '').toLowerCase();
  if (patient.needsFollowup || text.includes('follow')) return 'danger';
  if (text.includes('monitor') || text.includes('new')) return 'warning';
  return 'good';
}
function statusPill(patient) {
  const cls = statusClass(patient);
  return `<span class="status ${cls === 'danger' ? 'danger' : cls === 'warning' ? 'warning' : ''}">${escapeHtml(patient.status || 'Under monitoring')}</span>`;
}
function alertItems() {
  const visiblePatients = currentUser?.role === 'doctor' ? getPatientsForDoctor() : getPatients();
  return visiblePatients.filter(patient => patient.needsFollowup && !patient.reviewed).map(patient => ({ patient, message:patient.followUpMessage || 'This patient needs a post-operative follow-up.', id:patient.id }));
}
function visibleAlertItems() {
  const all = alertItems();
  if (currentUser && currentUser.role === 'doctor') return all;
  const mine = currentUser ? patientForEmail(currentUser.email) : null;
  return mine ? all.filter(alert => alert.patient.email.toLowerCase() === mine.email.toLowerCase()) : [];
}
function patientAvatarMarkup(patient, extraClass='') {
  const isDemoPatient = String(patient.email || '').toLowerCase() === 'patient@postopcare.com';
  const content = isDemoPatient ? `<img src="images/patient-profile.jpg" alt="Demo patient profile">` : escapeHtml(initials(patient.name));
  return `<div class="patient-avatar ${extraClass} ${isDemoPatient ? 'has-photo' : ''}">${content}</div>`;
}
function patientRow(patient, buttonLabel='View details') {
  return `<div class="patient-row">${patientAvatarMarkup(patient)}<div class="patient-info"><b>${escapeHtml(patient.name)}</b><small>${escapeHtml(patient.id)} · ${escapeHtml(patient.procedure || 'Post-operative care')}</small></div>${statusPill(patient)}<button type="button" class="mini-button" data-open-patient="${escapeHtml(patient.id)}">${escapeHtml(buttonLabel)}</button></div>`;
}
function careTeamCard() {
  const patient = currentPatient(); const doctor = getAssignedDoctor(patient);
  return `<div class="care-team-card"><img src="images/doctor-profile.jpg" alt="Assigned doctor profile"><div><b>${escapeHtml(doctor?.name || patient?.assignedDoctor || 'Doctor not assigned')}</b><small>Your assigned post-operative care doctor</small><span>Care team · Linked</span></div><i aria-hidden="true"></i></div>`;
}
function recoveryChart() {
  return `<div class="chart-wrap"><svg viewBox="0 0 600 190" role="img" aria-label="Patient recovery progress trend"><defs><linearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#3a91d8" stop-opacity=".25"/><stop offset="1" stop-color="#3a91d8" stop-opacity="0"/></linearGradient></defs>${[35,75,115,155].map(y=>`<line x1="24" y1="${y}" x2="580" y2="${y}" stroke="#eaf0f6" stroke-dasharray="4 5"/>`).join('')}<path d="M25 145 C85 138 100 120 145 125 S220 103 265 107 S340 77 380 84 S470 52 575 30 L575 164 L25 164Z" fill="url(#areaFill)"/><path d="M25 145 C85 138 100 120 145 125 S220 103 265 107 S340 77 380 84 S470 52 575 30" fill="none" stroke="#287fc8" stroke-width="3" stroke-linecap="round"/>${[[25,145],[145,125],[265,107],[380,84],[475,52],[575,30]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="4" fill="white" stroke="#287fc8" stroke-width="2"/>`).join('')}</svg></div><div class="chart-labels"><span>Oct 27</span><span>Oct 28</span><span>Oct 29</span><span>Oct 30</span><span>Oct 31</span><span>Today</span></div>`;
}
function doctorDashboard() {
  const patients = getPatientsForDoctor();
  const alerts = alertItems();
  const followups = patients.filter(p => p.needsFollowup).length;
  const inRecovery = patients.filter(p => !p.needsFollowup).length;
  return `${heading('Doctor Dashboard', `<span class="date-pill">▦ ${todayLabel()}</span><button type="button" class="btn btn-primary" data-action="add-patient">＋ Add patient</button>`)}
    <section class="dashboard-hero"><div><span class="hero-chip">DOCTOR WORKSPACE</span><h2>Good to see you, ${escapeHtml(currentUser.name)}</h2><p>Monitor your patients after discharge, review recovery updates, and identify cases that need follow-up.</p><div class="doctor-profile-inline"><img src="images/doctor-profile.jpg" alt="Doctor profile photo"><div><b>${escapeHtml(currentUser.name)}</b><small>Post-operative care physician · Account profile</small></div></div><div class="notice" style="margin-top:12px"><b>Your patient invitation code</b><br><strong style="font-size:20px;letter-spacing:2px">${escapeHtml(currentUser.inviteCode || 'Not configured')}</strong><br><small>Share this code only with patients you are responsible for. They enter it during registration to link their account to you.</small></div></div><div class="hero-photo-frame"><img src="images/doctor-patient-hero.jpg" alt="Doctor reviewing a recovering patient in a hospital room"><span>Post-operative follow-up</span></div></section>
    <div class="grid stats-grid">${statCard('Total patients', patients.length, '♙', 'Assigned to your care')}${statCard('In recovery', inRecovery, '♥', 'Patients progressing', 'green')}${statCard('Urgent alerts', alerts.length, '⚑', alerts.length ? 'Require your review' : 'No urgent alerts', alerts.length ? 'red' : 'green')}${statCard('Follow-up needed', followups, '◷', 'Cases to check today', followups ? 'orange' : 'green')}</div>
    <div class="grid two-col">
      <section class="panel"><div class="panel-head"><div><h3>Recovery Progress Overview</h3><p>Illustrative recovery trend across your assigned patients</p></div><span class="status">Live demo</span></div>${recoveryChart()}<div class="legend"><span><i></i>Recovery progress</span><span>Illustrative sample data</span></div></section>
      <section class="panel"><div class="panel-head"><div><h3>Urgent Alerts</h3><p>Patients who need your attention</p></div><button type="button" class="text-button" data-action="open-alerts">View all alerts →</button></div><div class="alert-list">${alerts.length ? alerts.slice(0,3).map(alert=>alertRow(alert)).join('') : `<div class="empty-state">✓<strong>No urgent alerts</strong>All current patient alerts have been reviewed.</div>`}</div></section>
    </div>
    <section class="panel" style="margin-top:15px"><div class="panel-head"><div><h3>Recent Patients</h3><p>Patients recently added to your post-operative care list</p></div><button type="button" class="text-button" data-action="view-patients">View all patients →</button></div><div class="patient-list">${patients.slice(0,4).map(p=>patientRow(p)).join('') || '<div class="empty-state">No patients have been added yet.</div>'}</div></section>`;
}
function alertRow(alert) {
  return `<div class="alert-row"><div class="alert-icon">!</div><div class="alert-copy"><b>${escapeHtml(alert.patient.name)} · ${escapeHtml(alert.patient.id)}</b><small>${escapeHtml(alert.message)}</small><div class="alert-actions"><button type="button" class="mini-button" data-open-patient="${escapeHtml(alert.patient.id)}">View patient</button><button type="button" class="mini-button" data-review-alert="${escapeHtml(alert.patient.id)}">Mark reviewed</button></div></div></div>`;
}
function latestVitals(email) {
  const checks = getCheckins(email);
  return checks[0] || { pain:'2', temperature:'36.8', heartRate:'72', oxygen:'98', date:'No check-in yet' };
}
function patientDashboard() {
  const patient = currentPatient() || { name:currentUser.name, procedure:currentUser.surgery || 'Post-operative recovery', progress:20, surgeryDate:currentUser.surgeryDate || '', status:'Under monitoring', nextAppointment:'To be scheduled', needsFollowup:false };
  const latest = latestVitals(currentUser.email);
  const medications = getMedicationState(currentUser.email);
  const done = medications.filter(Boolean).length;
  const days = patient.surgeryDate ? Math.max(1, Math.floor((new Date() - new Date(`${patient.surgeryDate}T00:00:00`))/86400000)+1) : 1;
  const pct = Math.max(0, Math.min(100, Number(patient.progress || 0)));
  const alertsHtml = patient.needsFollowup && !patient.reviewed ? `<div class="alert-row"><div class="alert-icon">!</div><div class="alert-copy"><b>Important recovery alert</b><small>${escapeHtml(patient.followUpMessage || 'Your doctor would like to review your recovery update.')}</small></div></div>` : `<div class="alert-row reviewed"><div class="alert-icon">✓</div><div class="alert-copy"><b>No urgent alerts</b><small>Keep following your discharge instructions and daily recovery plan.</small></div></div>`;
  return `${heading('Patient Dashboard', `<span class="date-pill">▦ ${todayLabel()}</span>`)}
    <section class="dashboard-hero"><div><span class="hero-chip">YOUR RECOVERY JOURNEY</span><h2>Welcome back, ${escapeHtml(currentUser.name.split(' ')[0])}!</h2><p>Here is your recovery overview. Keep your daily updates complete so your doctor can follow your progress after discharge.</p><div class="shortcut-row"><button type="button" class="btn btn-primary" data-screen="Daily Check-in">Complete daily check-in →</button><button type="button" class="btn btn-outline" data-screen="Medication & Wound Care">View wound care</button></div></div><div class="hero-photo-frame patient-hero-photo"><img src="images/doctor-patient-hero.jpg" alt="Doctor checking on a patient after surgery"><span>Your care team is with you</span></div></section>
    <div class="grid stats-grid">${statCard('Days after operation', days, '▦', 'Since your procedure')}${statCard('Recovery progress', `${pct}%`, '♥', 'Your current recovery plan', 'green')}${statCard('Medication doses', `${done}/3`, '✚', 'Doses marked as taken')}${statCard('Next appointment', patient.nextAppointment || 'To be scheduled', '◷', 'Post-operative follow-up', 'orange')}</div>
    <div class="grid two-col">
      <section class="panel"><div class="panel-head"><div><h3>Your Recovery Progress</h3><p>${escapeHtml(patient.procedure || 'Post-operative recovery')} · ${escapeHtml(patient.status || 'Under monitoring')}</p></div><span class="status">${pct >= 70 ? 'On track' : 'In progress'}</span></div><div class="recovery-card"><div class="ring" style="--progress:${pct*3.6}deg"><b>${pct}%</b></div><div class="recovery-copy"><b>Keep going, ${escapeHtml(currentUser.name.split(' ')[0])}!</b><small>Care-plan completion estimate. It is not a clinical healing score or a recovery prediction.</small><div class="progress" style="margin-top:12px"><span style="width:${pct}%"></span></div></div></div><div class="notice"><b>What does this percentage mean?</b> It represents completion of the follow-up care plan (for example: daily check-ins, medication tracking, wound updates, and scheduled reviews). It is not a medical measurement of wound healing, probability of recovery, or a prediction of when you will recover. In this prototype the starting value is illustrative and should be updated by the clinician against documented care-plan milestones.</div></section>
      <section class="panel"><div class="panel-head"><div><h3>Recent Health Readings</h3><p>Latest values from your daily check-in</p></div><button type="button" class="text-button" data-screen="Daily Check-in">Update now →</button></div><div class="health-reading-grid"><div class="reading-card"><span class="reading-icon">🌡</span><div class="reading-value">${escapeHtml(latest.temperature || '—')}°</div><div class="reading-label">Temperature</div></div><div class="reading-card"><span class="reading-icon">♥</span><div class="reading-value">${escapeHtml(latest.heartRate || '—')}</div><div class="reading-label">Heart rate · bpm</div></div><div class="reading-card"><span class="reading-icon">◉</span><div class="reading-value">${escapeHtml(latest.oxygen || '—')}%</div><div class="reading-label">Oxygen level</div></div></div></section>
    </div>
    <div class="grid two-col" style="margin-top:15px"><section class="panel"><div class="panel-head"><div><h3>Patient Information</h3><p>Your personal details saved in this account</p></div><button type="button" class="text-button" data-action="edit-my-sex">Edit details →</button></div><div class="detail-grid"><div class="detail-item"><small>Full name</small><b>${escapeHtml(currentUser.name)}</b></div><div class="detail-item"><small>Sex / Gender</small><b>${escapeHtml(normalizeSex(patient.sex ?? currentUser.sex))}</b></div><div class="detail-item"><small>Procedure</small><b>${escapeHtml(patient.procedure || 'Post-operative recovery')}</b></div><div class="detail-item"><small>Surgery date</small><b>${escapeHtml(patient.surgeryDate || 'Not provided')}</b></div></div></section><section class="panel"><div class="panel-head"><div><h3>Important Alerts</h3><p>Messages related to your recovery</p></div></div><div class="alert-list">${alertsHtml}</div></section></div>
    <div class="grid two-col" style="margin-top:15px"><section class="panel"><div class="panel-head"><div><h3>Your Medication Summary</h3><p>Today's dose tracking</p></div><button type="button" class="text-button" data-screen="Medication & Wound Care">View medication →</button></div>${careTeamCard()}${medicationSummary(currentUser.email)}</section><section class="panel"><div class="panel-head"><div><h3>Recovery support</h3><p>Keep your daily health information up to date.</p></div></div><div class="checkin-visual"><img src="images/doctor-profile.jpg" alt="Dr. Ahmed Rabie profile"><div><b>Dr. Ahmed Rabie</b><small>Your assigned post-operative care physician.</small></div></div><div class="notice">Your personal details are part of this local demonstration record. Do not enter real patient data.</div></section></div>`;
}
function medicationSummary(email) {
  const list = [
    ['Antibiotic Capsule','2 times daily','08:00 AM'],
    ['Pain Relief Tablet','As prescribed','02:00 PM'],
    ['Vitamin Supplement','1 daily','08:00 PM']
  ];
  const state = getMedicationState(email);
  return list.map((med,i)=>`<div class="reminder"><span class="reminder-icon">💊</span><div style="flex:1"><b>${med[0]}</b><small>${med[1]} · ${med[2]}</small></div><span class="status ${state[i]?'':'warning'}">${state[i]?'Taken':'Pending'}</span></div>`).join('');
}
function dailyCheckin() {
  const checks = getCheckins(currentUser.email);
  const latest = checks[0] || {};
  return `${heading('Daily Check-in')}
    <div class="purpose-note">Submit today's symptoms and health readings. Your doctor can review these updates in Patient Details &amp; Reports.</div>
    <div class="grid two-col">
      <section class="panel"><div class="panel-head"><div><h3>How are you feeling today?</h3><p>Complete the fields below and submit your daily health status.</p></div><span class="date-pill">${todayLabel()}</span></div>
        <form id="checkinForm">
          <div class="field"><label for="painRange">Pain level (0 = no pain, 10 = severe pain)</label><div class="pain-face-row" aria-label="Quick pain level choices">${[[0,'😃','No pain'],[2,'🙂','Mild'],[5,'😐','Moderate'],[8,'😟','High'],[10,'😣','Severe']].map(([v,emoji,label])=>`<button type="button" class="pain-face ${Number(latest.pain || 2)===v?'active':''}" data-pain-value="${v}" aria-label="${label} pain" title="${label}"><span>${emoji}</span><small>${label}</small></button>`).join('')}</div><div class="range-line"><input id="painRange" type="range" min="0" max="10" value="${escapeHtml(latest.pain || '2')}"><span class="range-value" id="painValue">${escapeHtml(latest.pain || '2')}</span></div></div>
          <div class="form-grid"><div class="field"><label for="temperature">Temperature (°C)</label><input id="temperature" type="number" min="34" max="42" step="0.1" value="${escapeHtml(latest.temperature || '36.8')}" required></div><div class="field"><label for="heartRate">Heart rate (bpm)</label><input id="heartRate" type="number" min="30" max="220" value="${escapeHtml(latest.heartRate || '72')}" required></div><div class="field"><label for="oxygen">Oxygen saturation (%)</label><input id="oxygen" type="number" min="50" max="100" value="${escapeHtml(latest.oxygen || '98')}" required></div><div class="field"><label for="woundCondition">Wound condition</label><select id="woundCondition"><option value="Looks good">Looks good</option><option value="Some redness">Some redness</option><option value="Swelling">Swelling</option><option value="Discharge">Discharge</option><option value="Bleeding">Bleeding</option></select></div></div>
          <div class="field"><label>Symptoms (select all that apply)</label><div class="symptom-checks"><label><input type="checkbox" name="symptom" value="Fever"> Fever</label><label><input type="checkbox" name="symptom" value="Fatigue"> Fatigue</label><label><input type="checkbox" name="symptom" value="Nausea"> Nausea</label><label><input type="checkbox" name="symptom" value="Pain"> Increased pain</label><label><input type="checkbox" name="symptom" value="Dizziness"> Dizziness</label><label><input type="checkbox" name="symptom" value="Breathing difficulty"> Breathing difficulty</label></div></div>
          <div class="field"><label for="checkinNotes">Additional notes</label><textarea id="checkinNotes" placeholder="Describe any changes or concerns..."></textarea></div>
          <div class="form-actions"><button type="reset" class="btn btn-outline">Reset form</button><button type="submit" class="btn btn-primary">Submit Check-in →</button></div>
        </form>
      </section>
      <section class="panel"><div class="panel-head"><div><h3>Previous Check-ins</h3><p>Your recent submitted health updates</p></div><span class="status">${checks.length} saved</span></div>${checks.length ? `<div class="timeline">${checks.slice(0,6).map(checkinTimeline).join('')}</div>` : `<div class="empty-state">☷<strong>No check-ins yet</strong>Your submitted updates will appear here.</div>`}<div class="checkin-visual"><img src="images/doctor-profile.jpg" alt="Dr. Ahmed Rabie profile"><div><b>Dr. Ahmed Rabie · Your care team</b><small>Regular updates help your doctor understand how your recovery is progressing.</small></div></div><div class="notice">This prototype stores updates in this browser only. It does not transmit medical information to a real doctor or hospital.</div></section>
    </div>`;
}
function checkinTimeline(item) {
  const details = [`Pain ${escapeHtml(item.pain)}/10`, `${escapeHtml(item.temperature)}°C`, `Heart rate ${escapeHtml(item.heartRate)} bpm`, `Oxygen ${escapeHtml(item.oxygen)}%`].join(' · ');
  return `<div class="timeline-item"><span class="timeline-dot">✓</span><div><b>${escapeHtml(item.date || '')}</b><small>${details}${item.flags ? `<br>Symptoms: ${escapeHtml(item.flags)}` : ''}${item.notes ? `<br>Notes: ${escapeHtml(item.notes)}` : ''}</small></div></div>`;
}
function medicationPage() {
  const medications = [
    {name:'Antibiotic Capsule', dose:'1 capsule · 2 times daily', time:'08:00 AM and 08:00 PM', instruction:'Take only as prescribed by your surgeon.'},
    {name:'Pain Relief Tablet', dose:'1 tablet · As prescribed', time:'When required', instruction:'Do not exceed the prescribed dose.'},
    {name:'Vitamin Supplement', dose:'1 tablet · Daily', time:'After breakfast', instruction:'Follow the instructions on your prescription.'}
  ];
  const state = getMedicationState(currentUser.email);
  const photo = getWoundPhoto(currentUser.email);
  return `${heading('Medication & Wound Care')}
    <div class="purpose-note">Review your medication schedule, record completed doses, and upload a clear wound photo for your doctor's follow-up.</div>
    <div class="grid two-col"><section class="panel"><div class="panel-head"><div><h3>Medication Schedule</h3><p>Demo schedule — always follow your actual prescription.</p></div><span class="status">${state.filter(Boolean).length}/3 taken</span></div>
      ${medications.map((med,i)=>`<div class="reminder"><span class="reminder-icon">💊</span><div style="flex:1"><b>${med.name}</b><small>${med.dose}<br>${med.time}</small></div><span class="status ${state[i]?'':'warning'}">${state[i]?'Taken':'Pending'}</span><button type="button" class="mini-button" data-medication="${i}">${state[i]?'Undo':'Mark taken'}</button></div><p class="muted">${med.instruction}</p>`).join('')}
      <div class="notice">Medication names and doses are illustrative examples only. Use the medicine and dosage prescribed for your own procedure.</div>
    </section>
    <section class="panel"><div class="panel-head"><div><h3>Wound Photo Upload</h3><p>Upload a recent photo for post-operative follow-up.</p></div><span class="status">Photo update</span></div>
      ${photo ? `<img id="savedWoundPhoto" class="wound-small" src="${photo}" alt="Uploaded patient wound photo">` : `<div class="empty-state">▧<strong>No patient photo uploaded yet</strong>Choose a photo of your current wound below to add an update.</div>`}
      <label class="upload-zone" for="woundFile"><strong>＋ Upload a new wound photo</strong><small>JPG, PNG or WebP · up to 5 MB</small></label><input id="woundFile" type="file" accept="image/*" hidden>
      <img id="woundUploadPreview" class="wound-preview" alt="New wound photo preview" hidden>
      <div class="form-actions"><button type="button" class="btn btn-outline" data-action="clear-wound">Remove saved photo</button><button type="button" class="btn btn-primary" id="saveWoundButton" disabled>Save photo update</button></div>
      <p class="muted">The photo is stored locally in this browser for this demo. It is not uploaded to a cloud server.</p>
    </section></div>
    <div class="wound-layout" style="margin-top:15px"><section class="panel"><div class="panel-head"><div><h3>Surgical Wound Photo Gallery</h3><p>Realistic reference views of a sutured post-operative incision.</p></div><span class="status neutral">Reference images</span></div><div class="wound-gallery"><figure><img class="wound-reference" src="images/surgical-stitches-reference.jpg" alt="Clinical reference photograph showing suturing during surgery"><figcaption>Full clinical view · surgical sutures</figcaption></figure><figure><img class="wound-closeup" src="images/sutures-closeup.jpg" alt="Close-up reference photograph of stitches closing a surgical incision"><figcaption>Close-up view · incision closure</figcaption></figure></div><p class="image-caption">Both are reference photographs for project demonstration only. They are not photos of the signed-in patient's wound and must not be used to diagnose a medical condition.</p></section>
      <section class="panel"><div class="panel-head"><div><h3>Daily Wound Care Reminders</h3><p>Follow your discharge instructions.</p></div></div><div class="care-tip"><span>✧</span><div><b>Clean hands</b><small>Wash your hands before touching the dressing or the area around the incision.</small></div></div><div class="care-tip"><span>◇</span><div><b>Keep the dressing as instructed</b><small>Keep the wound clean and dry according to your surgeon's advice.</small></div></div><div class="care-tip"><span>!</span><div><b>Watch for warning signs</b><small>Increasing redness, fever, worsening pain, bleeding, or discharge need clinical advice.</small></div></div>${careTeamCard()}</section></div>`;
}

function patientDetailsPage() {
  const patients = getPatientsForDoctor();
  if (!selectedPatientId || !patients.some(p => p.id === selectedPatientId)) selectedPatientId = patients[0]?.id || null;
  const selected = patients.find(p => p.id === selectedPatientId);
  const action = `<button type="button" class="btn btn-primary" data-action="add-patient">＋ Add patient</button>`;
  if (!selected) return `${heading('Patient Details & Reports', action)}<section class="panel empty-state">No patient records yet.<strong>Add a patient to start follow-up.</strong></section>`;
  const checks = getCheckins(selected.email);
  const photo = getWoundPhoto(selected.email);
  const latest = checks[0];
  const pct = Math.max(0, Math.min(100, Number(selected.progress) || 0));
  const meds = getMedicationState(selected.email);
  return `${heading('Patient Details & Reports', action)}
    <div class="toolbar patient-toolbar"><input type="search" id="patientSearch" class="search-box" placeholder="Search by patient name, ID, or procedure..." aria-label="Search patient records"><span class="date-pill">${patients.length} patient records</span></div>
    <div class="detail-layout">
      <section class="panel patient-directory-panel"><div class="panel-head"><div><h3>Patient List</h3><p>Select a patient to open their full record.</p></div><span class="status">${patients.length} total</span></div><div id="patientDirectory" class="patient-list">${patients.map(p=>`<div class="patient-row ${p.id===selected.id?'selected-row':''}">${patientAvatarMarkup(p)}<div class="patient-info"><b>${escapeHtml(p.name)}</b><small>${escapeHtml(p.id)} · ${escapeHtml(p.procedure || 'Post-operative care')}</small></div>${statusPill(p)}<button type="button" class="mini-button" data-select-patient="${escapeHtml(p.id)}">Open</button></div>`).join('')}</div></section>
      <div class="grid patient-record-column">
        <section class="panel patient-record-card">
          <div class="panel-head"><div><h3>Medical Record</h3><p>Patient information and current post-operative status</p></div><div class="inline-actions"><button type="button" class="btn btn-outline" data-action="edit-patient" data-id="${escapeHtml(selected.id)}">Edit details</button><button type="button" class="btn btn-primary" data-detail-tab-jump="reports">Generate Report ↗</button></div></div>
          <div class="patient-summary">${patientAvatarMarkup(selected)}<div style="min-width:0;flex:1"><b>${escapeHtml(selected.name)}</b><small>${escapeHtml(selected.id)} · ${escapeHtml(selected.email)}</small></div>${statusPill(selected)}</div>
          <div class="detail-grid"><div class="detail-item"><small>Sex / Gender</small><b>${escapeHtml(normalizeSex(selected.sex))}</b></div><div class="detail-item"><small>Procedure</small><b>${escapeHtml(selected.procedure || 'Not specified')}</b></div><div class="detail-item"><small>Surgery date</small><b>${escapeHtml(selected.surgeryDate || 'Not provided')}</b></div><div class="detail-item"><small>Phone number</small><b>${escapeHtml(selected.phone || 'Not provided')}</b></div><div class="detail-item"><small>Next appointment</small><b>${escapeHtml(selected.nextAppointment || 'To be scheduled')}</b></div></div>
          <div class="record-progress"><div class="panel-head"><div><h3>Recovery Progress</h3><p>${pct}% completion</p></div><strong class="progress-number">${pct}%</strong></div><div class="progress"><span style="width:${pct}%"></span></div></div>
        </section>
        <section class="panel patient-tabs-panel">
          <div class="detail-tabs" role="tablist" aria-label="Patient record sections">
            <button type="button" class="detail-tab active" role="tab" aria-selected="true" data-detail-tab="medical">Medical History</button>
            <button type="button" class="detail-tab" role="tab" aria-selected="false" data-detail-tab="recovery">Recovery Progress</button>
            <button type="button" class="detail-tab" role="tab" aria-selected="false" data-detail-tab="wound">Wound Updates</button>
            <button type="button" class="detail-tab" role="tab" aria-selected="false" data-detail-tab="reports">Reports</button>
          </div>
          <section class="detail-tab-content" role="tabpanel" data-detail-panel="medical">
            <div class="grid two-col"><section><div class="panel-head"><div><h3>Medical History</h3><p>Patient surgery and health updates</p></div><span class="status">${checks.length} check-ins</span></div>
              <div class="assigned-doctor-card"><img src="images/doctor-profile.jpg" alt="Assigned doctor profile"><div><b>${escapeHtml(getAssignedDoctor(selected)?.name || selected.assignedDoctor || 'Doctor not assigned')}</b><small>Assigned post-operative care physician</small></div><span class="status">Care team</span></div><div class="detail-grid"><div class="detail-item"><small>Patient ID</small><b>${escapeHtml(selected.id)}</b></div><div class="detail-item"><small>Procedure</small><b>${escapeHtml(selected.procedure || 'Not specified')}</b></div><div class="detail-item"><small>Surgery date</small><b>${escapeHtml(selected.surgeryDate || 'Not provided')}</b></div><div class="detail-item"><small>Next appointment</small><b>${escapeHtml(selected.nextAppointment || 'To be scheduled')}</b></div></div>
            </section><section><div class="panel-head"><div><h3>Latest Health Readings</h3><p>Most recent patient check-in</p></div></div>
              ${latest ? `<div class="health-reading-grid"><div class="reading-card"><div class="reading-label">Pain level</div><div class="reading-value">${escapeHtml(latest.pain)}/10</div></div><div class="reading-card"><div class="reading-label">Temperature</div><div class="reading-value">${escapeHtml(latest.temperature)}°C</div></div><div class="reading-card"><div class="reading-label">Oxygen</div><div class="reading-value">${escapeHtml(latest.oxygen)}%</div></div></div><p class="muted">Heart rate: ${escapeHtml(latest.heartRate)} bpm · Wound: ${escapeHtml(latest.wound || 'Not reported')}</p>` : `<div class="empty-state">No health readings submitted yet.</div>`}
            </section></div>
            <div class="panel-head" style="margin-top:18px"><div><h3>Recovery History</h3><p>Chronological check-in history</p></div></div>
            <div class="timeline"><div class="timeline-item"><span class="timeline-dot">✓</span><div><b>Patient record created</b><small>${escapeHtml(selected.surgeryDate || '')} · ${escapeHtml(selected.procedure || '')}</small></div></div>${checks.slice(0,8).map(checkinTimeline).join('') || `<div class="timeline-item"><span class="timeline-dot">◷</span><div><b>No check-ins submitted</b><small>Patient updates will appear here after submission.</small></div></div>`}</div>
          </section>
          <section class="detail-tab-content" role="tabpanel" data-detail-panel="recovery" hidden>
            <div class="panel-head"><div><h3>Recovery Progress Overview</h3><p>Current recovery plan completion</p></div><span class="status">${pct >= 70 ? 'On track' : 'In progress'}</span></div>
            <div class="recovery-card"><div class="ring" style="--progress:${pct*3.6}deg"><b>${pct}%</b></div><div class="recovery-copy"><b>${escapeHtml(selected.name)}'s recovery progress</b><small>Progress is a demonstration value. A treating clinician should assess the patient's recovery.</small><div class="progress" style="margin-top:12px"><span style="width:${pct}%"></span></div></div></div>
            <div class="notice"><b>Clinical interpretation:</b> this percentage is a care-plan completion indicator only. It should be calculated from clinician-defined milestones (for example check-in completion 25%, medication adherence 25%, wound-care updates 25%, and scheduled follow-up/review 25%). Each milestone is scored from documented evidence. It does not diagnose healing, measure tissue repair, or guarantee recovery. A clinician must set weights appropriate to the procedure and review the score; missing data must be marked unknown, not assumed complete.</div>
            ${recoveryChart()}
            <div class="detail-grid"><div class="detail-item"><small>Check-ins received</small><b>${checks.length}</b></div><div class="detail-item"><small>Current status</small><b>${escapeHtml(selected.status || 'Under monitoring')}</b></div></div>
          </section>
          <section class="detail-tab-content" role="tabpanel" data-detail-panel="wound" hidden>
            <div class="panel-head"><div><h3>Wound Updates</h3><p>Review the latest photo and wound status information</p></div><span class="status">${photo ? 'Patient photo' : 'Reference photo'}</span></div>
            ${photo ? `<div class="wound-detail-gallery"><img class="wound-detail-image" src="${photo}" alt="Patient-submitted wound update"><img class="wound-detail-reference" src="images/sutures-closeup.jpg" alt="Reference close-up of surgical sutures"></div><p class="image-caption">The larger image is the patient-submitted photo saved in this browser. The smaller image is a separate clinical reference, not a photo of this patient.</p>` : `<div class="wound-detail-gallery"><img class="wound-detail-image" src="images/surgical-stitches-reference.jpg" alt="Clinical reference photo showing surgical stitches"><img class="wound-detail-reference" src="images/sutures-closeup.jpg" alt="Close-up reference of sutured incision"></div><p class="image-caption">Reference images only. They are not photos of this patient. A patient-submitted photo will appear here after upload.</p>`}
            ${latest ? `<div class="detail-item"><small>Latest reported wound condition</small><b>${escapeHtml(latest.wound || 'Not reported')}</b></div>` : ''}
          </section>
          <section class="detail-tab-content" role="tabpanel" data-detail-panel="reports" hidden>
            <div class="panel-head"><div><h3>Follow-up Report</h3><p>Prepared summary for the selected patient</p></div><span class="status">Ready to print</span></div>
            <div class="report-summary"><div><small>Patient</small><b>${escapeHtml(selected.name)}</b></div><div><small>Patient ID</small><b>${escapeHtml(selected.id)}</b></div><div><small>Sex / Gender</small><b>${escapeHtml(normalizeSex(selected.sex))}</b></div><div><small>Procedure</small><b>${escapeHtml(selected.procedure || 'Not specified')}</b></div><div><small>Care-plan completion</small><b>${pct}%</b></div><div><small>Latest check-in</small><b>${escapeHtml(latest?.date || 'No check-in yet')}</b></div><div><small>Medication doses marked taken</small><b>${meds.filter(Boolean).length} / ${meds.length}</b></div></div>
            <div class="notice">This is a front-end demonstration report generated from locally stored sample data. Confirm all clinical details before using any information outside this prototype.</div>
            <div class="form-actions"><button type="button" class="btn btn-primary" data-action="print-report">Print / Save report as PDF ↗</button></div>
          </section>
        </section>
      </div>
    </div>
    <div class="notice">Prototype only: patient information is stored in this browser and is not transmitted to a hospital system.</div>`;
}

function getMessages() { return readStore('postop_messages', []); }
function messagesPage() {
  const doctorPatients = currentUser.role === 'doctor' ? getPatientsForDoctor() : [];
  const patient = currentUser.role === 'patient' ? currentPatient() : (doctorPatients.find(p => p.id === selectedPatientId) || doctorPatients[0]);
  const email = patient?.email || currentUser.email;
  const messages = getMessages().filter(m => String(m.patientEmail || '').toLowerCase() === email.toLowerCase());
  const conversation = messages.map(m => `<div class="timeline-item"><span class="timeline-dot">${m.fromRole === 'doctor' ? 'DR' : 'P'}</span><div><b>${escapeHtml(m.fromName)} <span class="muted">· ${m.fromRole === 'doctor' ? 'Doctor' : 'Patient'}</span></b><small>${escapeHtml(m.date)}</small><p>${escapeHtml(m.body)}</p></div></div>`).join('');
  const doctorSelect = currentUser.role === 'doctor' ? (doctorPatients.length ? `<div class="field"><label for="messagePatient">Choose patient</label><select id="messagePatient">${doctorPatients.map(p => `<option value="${escapeHtml(p.id)}" ${p.id === patient?.id ? 'selected' : ''}>${escapeHtml(p.name)} — ${escapeHtml(p.id)}</option>`).join('')}</select></div>` : '<div class="empty-state">No patients are linked to your account yet. Share your invitation code with your patients.</div>') : `<div class="assigned-doctor-card"><img src="images/doctor-profile.jpg" alt="Assigned doctor"><div><b>${escapeHtml(getAssignedDoctor(patient)?.name || patient?.assignedDoctor || 'Doctor not assigned')}</b><small>Your assigned post-operative care doctor</small></div><span class="status">Care team</span></div>`;
  return `${heading('Messages', '<span class="status">Care team communication</span>')}<section class="panel"><div class="panel-head"><div><h3>Conversation</h3><p>${currentUser.role === 'doctor' ? 'Reply to the selected patient' : 'Send a question or recovery update to your assigned doctor'}</p></div></div>${doctorSelect}<div class="timeline message-thread">${conversation || '<div class="empty-state">✉<strong>No messages yet</strong>Start a conversation with your care team.</div>'}</div>${patient ? `<form id="messageForm"><div class="field"><label for="messageBody">Your message</label><textarea id="messageBody" rows="4" maxlength="1000" required placeholder="Type your message..."></textarea></div><div class="form-actions"><button class="btn btn-primary" type="submit">Send message →</button></div></form>` : ''}<div class="notice">Demo communication: messages are saved in this browser only. This is not a live or emergency messaging service. For urgent symptoms, contact emergency services or your healthcare provider directly.</div></section>`;
}
function sendMessage(event) {
  event.preventDefault();
  const body = $('messageBody').value.trim();
  if (!body) return;
  let patient = currentUser.role === 'patient' ? currentPatient() : getPatientsForDoctor().find(p => p.id === $('messagePatient')?.value);
  if (!patient) { showToast('No patient is linked to this conversation.'); return; }
  const messages = getMessages();
  messages.push({ id:newId('MSG'), patientEmail:patient.email, fromRole:currentUser.role, fromName:currentUser.name, body, date:new Date().toLocaleString() });
  if (!writeStore('postop_messages', messages)) return;
  if (currentUser.role === 'doctor') selectedPatientId = patient.id;
  renderApp(); showToast('Message sent.');
}

function renderApp() {
  renderNavigation();
  $('breadcrumbTitle').textContent = currentScreen;
  $('notificationCount').textContent = visibleAlertItems().length;
  $('notificationCount').hidden = visibleAlertItems().length === 0;
  let html = '';
  if (currentScreen === 'Doctor Dashboard' && currentUser.role === 'doctor') html = doctorDashboard();
  else if (currentScreen === 'Patient Details & Reports' && currentUser.role === 'doctor') html = patientDetailsPage();
  else if (currentScreen === 'Patient Dashboard' && currentUser.role === 'patient') html = patientDashboard();
  else if (currentScreen === 'Daily Check-in' && currentUser.role === 'patient') html = dailyCheckin();
  else if (currentScreen === 'Medication & Wound Care' && currentUser.role === 'patient') html = medicationPage();
  else if (currentScreen === 'Messages') html = messagesPage();
  else {
    currentScreen = currentUser.role === 'doctor' ? 'Doctor Dashboard' : 'Patient Dashboard';
    $('breadcrumbTitle').textContent = currentScreen;
    renderNavigation();
    html = currentUser.role === 'doctor' ? doctorDashboard() : patientDashboard();
  }
  $('pageContent').innerHTML = html;
  bindPageEvents();
}

function bindPageEvents() {
  // Screen shortcuts and patient records.
  $('pageContent').querySelectorAll('[data-screen]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.screen)));
  $('pageContent').querySelectorAll('[data-open-patient], [data-select-patient]').forEach(button => button.addEventListener('click', () => {
    selectedPatientId = button.dataset.openPatient || button.dataset.selectPatient;
    navigate('Patient Details & Reports');
  }));
  $('pageContent').querySelectorAll('[data-review-alert]').forEach(button => button.addEventListener('click', () => reviewAlert(button.dataset.reviewAlert)));
  $('pageContent').querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => handleAction(button.dataset.action, button.dataset.id)));
  const messageForm = $('messageForm');
  if (messageForm) messageForm.addEventListener('submit', sendMessage);
  const messagePatient = $('messagePatient');
  if (messagePatient) messagePatient.addEventListener('change', () => { selectedPatientId = messagePatient.value; renderApp(); });
  $('pageContent').querySelectorAll('[data-medication]').forEach(button => button.addEventListener('click', () => toggleMedication(Number(button.dataset.medication))));
  $('pageContent').querySelectorAll('[data-detail-tab], [data-detail-tab-jump]').forEach(button => button.addEventListener('click', () => {
    const tab = button.dataset.detailTab || button.dataset.detailTabJump;
    $('pageContent').querySelectorAll('[data-detail-tab]').forEach(item => {
      const active = item.dataset.detailTab === tab;
      item.classList.toggle('active', active);
      item.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    $('pageContent').querySelectorAll('[data-detail-panel]').forEach(panel => { panel.hidden = panel.dataset.detailPanel !== tab; });
  }));

  const pain = $('painRange');
  if (pain) {
    const syncPain = () => {
      $('painValue').textContent = pain.value;
      $('pageContent').querySelectorAll('[data-pain-value]').forEach(button => button.classList.toggle('active', Number(button.dataset.painValue) === Number(pain.value)));
    };
    pain.addEventListener('input', syncPain);
    $('pageContent').querySelectorAll('[data-pain-value]').forEach(button => button.addEventListener('click', () => {
      pain.value = button.dataset.painValue;
      syncPain();
    }));
  }
  const checkinForm = $('checkinForm');
  if (checkinForm) checkinForm.addEventListener('submit', submitCheckin);

  const woundFile = $('woundFile');
  if (woundFile) woundFile.addEventListener('change', previewWoundPhoto);
  const saveWound = $('saveWoundButton');
  if (saveWound) saveWound.addEventListener('click', saveWoundUpdate);

  const search = $('patientSearch');
  if (search) {
    const filterPatients = () => {
      const query = search.value.trim().toLowerCase();
      const directory = $('patientDirectory');
      if (!directory) return;
      directory.querySelectorAll('.patient-row').forEach(row => {
        row.hidden = !row.textContent.toLowerCase().includes(query);
      });
    };
    search.addEventListener('input', filterPatients);
  }
}

function submitCheckin(event) {
  event.preventDefault();
  const temperature = Number($('temperature').value);
  const heartRate = Number($('heartRate').value);
  const oxygen = Number($('oxygen').value);
  const pain = Number($('painRange').value);
  if (!Number.isFinite(temperature) || temperature < 34 || temperature > 42) { showToast('Enter a valid temperature between 34 and 42 °C.'); return; }
  if (!Number.isFinite(heartRate) || heartRate < 30 || heartRate > 220) { showToast('Enter a valid heart rate between 30 and 220 bpm.'); return; }
  if (!Number.isFinite(oxygen) || oxygen < 50 || oxygen > 100) { showToast('Enter oxygen saturation between 50 and 100%.'); return; }
  const flags = [...event.currentTarget.querySelectorAll('input[name="symptom"]:checked')].map(input => input.value);
  const item = {
    id:newId('CHK'), date:new Date().toLocaleString('en-US'), pain, temperature:temperature.toFixed(1), heartRate, oxygen,
    wound:$('woundCondition').value, flags:flags.join(', '), notes:$('checkinNotes').value.trim()
  };
  const all = getCheckins(currentUser.email);
  all.unshift(item);
  if (!writeStore(STORE.checkins + currentUser.email.toLowerCase(), all.slice(0,30))) return;
  const patients = getPatients();
  const patient = patients.find(p => p.email.toLowerCase() === currentUser.email.toLowerCase());
  if (patient) {
    // Do not increase a clinical recovery percentage from one normal check-in.
    // Progress is a clinician-reviewed care-plan completion estimate, not a healing measurement.
    const woundRisk = ['Swelling','Discharge','Bleeding'].includes(item.wound);
    const risk = pain >= 8 || temperature >= 38 || oxygen < 94 || flags.includes('Fever') || flags.includes('Breathing difficulty') || woundRisk;
    if (risk) {
      patient.needsFollowup = true;
      patient.reviewed = false;
      patient.status = 'Needs follow-up';
      patient.followUpMessage = `New check-in needs review: pain ${pain}/10, temperature ${item.temperature}°C, oxygen ${oxygen}%. ${flags.length ? `Symptoms: ${flags.join(', ')}.` : ''}`;
    } else if (!patient.needsFollowup || patient.reviewed) {
      patient.status = 'Recovering well';
      patient.needsFollowup = false;
      patient.reviewed = false;
    }
    savePatients(patients);
  }
  renderApp();
  showToast('Daily check-in submitted successfully.');
}

function toggleMedication(index) {
  const state = getMedicationState(currentUser.email);
  state[index] = !state[index];
  saveMedicationState(currentUser.email, state);
  renderApp();
  showToast(state[index] ? 'Medication marked as taken.' : 'Medication marked as pending.');
}
function previewWoundPhoto(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { showToast('Please choose an image file.'); event.target.value = ''; return; }
  if (file.size > 5 * 1024 * 1024) { showToast('Photo must be smaller than 5 MB.'); event.target.value = ''; return; }
  const reader = new FileReader();
  reader.onerror = () => showToast('The selected image could not be read.');
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const max = 1200;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const context = canvas.getContext('2d');
      context.drawImage(img, 0, 0, canvas.width, canvas.height);
      lastUploadedPhoto = canvas.toDataURL('image/jpeg', 0.78);
      $('woundUploadPreview').src = lastUploadedPhoto;
      $('woundUploadPreview').hidden = false;
      $('saveWoundButton').disabled = false;
    };
    img.onerror = () => showToast('The selected image could not be displayed.');
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}
function saveWoundUpdate() {
  if (!lastUploadedPhoto) { showToast('Choose a wound photo first.'); return; }
  if (!setWoundPhoto(currentUser.email, lastUploadedPhoto)) return;
  const patient = patientForEmail(currentUser.email);
  if (patient) {
    patient.woundUpdatedAt = new Date().toISOString();
    patient.status = patient.needsFollowup ? patient.status : 'Wound photo updated';
    savePatients(getPatients());
  }
  lastUploadedPhoto = '';
  renderApp();
  showToast('Wound photo update saved in this browser.');
}

function handleAction(action, id) {
  if (action === 'add-patient') openPatientModal();
  else if (action === 'edit-my-sex') openMySexModal();
  else if (action === 'view-patients') navigate('Patient Details & Reports');
  else if (action === 'open-alerts') openAlertsModal();
  else if (action === 'print-report') window.print();
  else if (action === 'clear-wound') {
    try { localStorage.removeItem(STORE.wound + currentUser.email.toLowerCase()); } catch {}
    lastUploadedPhoto = '';
    renderApp();
    showToast('Saved wound photo removed from this browser.');
  } else if (action === 'edit-patient') openPatientModal(getPatients().find(p => p.id === id));
}
function reviewAlert(id) {
  const patients = getPatients();
  const patient = patients.find(p => p.id === id);
  if (!patient) return;
  patient.reviewed = true;
  patient.needsFollowup = false;
  patient.status = 'Under monitoring';
  savePatients(patients);
  closeModal();
  renderApp();
  showToast(`Alert for ${patient.name} marked as reviewed.`);
}

function openAlertsModal() {
  const alerts = visibleAlertItems();
  const alertMarkup = currentUser.role === 'doctor' ? alerts.map(alert=>alertRow(alert)).join('') : alerts.map(alert=>`<div class="alert-row"><div class="alert-icon">!</div><div class="alert-copy"><b>Your recovery update needs review</b><small>${escapeHtml(alert.message)} Your care team can review this update.</small></div></div>`).join('');
  const footer = currentUser.role === 'doctor' ? `<div class="form-actions"><button type="button" class="btn btn-outline" data-modal-close>Close</button><button type="button" class="btn btn-primary" data-modal-action="review-all">Mark all reviewed</button></div>` : `<div class="form-actions"><button type="button" class="btn btn-primary" data-modal-close>Done</button></div>`;
  openModal('Notifications & Urgent Alerts', alerts.length ? `<div class="alert-list">${alertMarkup}</div>${footer}` : `<div class="empty-state">✓<strong>No urgent alerts</strong>You are all caught up with your recovery notifications.</div>${footer}`);
}
function openModal(title, body) {
  $('modalRoot').innerHTML = `<div class="modal-backdrop" data-backdrop><section class="modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}"><div class="modal-head"><h3>${escapeHtml(title)}</h3><button type="button" class="close-button" data-modal-close aria-label="Close">×</button></div>${body}</section></div>`;
  $('modalRoot').querySelectorAll('[data-modal-close]').forEach(button => button.addEventListener('click', closeModal));
  const backdrop = $('modalRoot').querySelector('[data-backdrop]');
  backdrop.addEventListener('click', event => { if (event.target === backdrop) closeModal(); });
  $('modalRoot').querySelectorAll('[data-open-patient]').forEach(button => button.addEventListener('click', () => {
    selectedPatientId = button.dataset.openPatient;
    closeModal();
    navigate('Patient Details & Reports');
  }));
  $('modalRoot').querySelectorAll('[data-review-alert]').forEach(button => button.addEventListener('click', () => reviewAlert(button.dataset.reviewAlert)));
  $('modalRoot').querySelectorAll('[data-modal-action="review-all"]').forEach(button => button.addEventListener('click', () => {
    const patients = getPatients();
    patients.forEach(patient => { if (patient.needsFollowup) { patient.needsFollowup = false; patient.reviewed = true; patient.status = 'Under monitoring'; } });
    savePatients(patients); closeModal(); renderApp(); showToast('All current alerts marked as reviewed.');
  }));
}
function closeModal() { $('modalRoot').innerHTML = ''; }

function openMySexModal() {
  const patient = currentPatient();
  const currentSex = normalizeSex(patient?.sex ?? currentUser.sex);
  const body = `<form id="mySexForm"><div class="field"><label for="myPatientSex">Sex / Gender <span class="muted">(optional)</span></label><select id="myPatientSex"><option value="Not Specified" ${currentSex==='Not Specified'?'selected':''}>Not Specified</option><option value="Male" ${currentSex==='Male'?'selected':''}>Male</option><option value="Female" ${currentSex==='Female'?'selected':''}>Female</option></select></div><div class="form-actions"><button type="button" class="btn btn-outline" data-modal-close>Cancel</button><button type="submit" class="btn btn-primary">Save details</button></div></form>`;
  openModal('Update Personal Details', body);
  $('mySexForm').addEventListener('submit', event => {
    event.preventDefault();
    const sex = normalizeSex($('myPatientSex').value);
    currentUser.sex = sex;
    const users = getUsers();
    const account = users.find(user => String(user.email).toLowerCase() === currentUser.email.toLowerCase());
    if (account) account.sex = sex;
    saveUsers(users);
    const patients = getPatients();
    const record = patients.find(item => String(item.email).toLowerCase() === currentUser.email.toLowerCase());
    if (record) record.sex = sex;
    savePatients(patients);
    closeModal();
    renderApp();
    showToast('Your personal details have been updated.');
  });
}

function openPatientModal(existing = null) {
  const p = existing || {};
  const isEdit = Boolean(existing);
  const body = `<form id="patientForm" novalidate><div class="form-grid"><div class="field"><label for="newPatientName">Patient full name</label><input id="newPatientName" required value="${escapeHtml(p.name || '')}" placeholder="Patient name"></div><div class="field"><label for="newPatientEmail">Email address</label><input id="newPatientEmail" type="email" required value="${escapeHtml(p.email || '')}" placeholder="patient@example.com" ${isEdit?'readonly':''}></div><div class="field"><label for="newPatientPhone">Phone number</label><input id="newPatientPhone" value="${escapeHtml(p.phone || '')}" placeholder="Phone number"></div><div class="field"><label for="newPatientSex">Sex / Gender <span class="muted">(optional)</span></label><select id="newPatientSex"><option value="Not Specified" ${normalizeSex(p.sex)==='Not Specified'?'selected':''}>Not Specified</option><option value="Male" ${normalizeSex(p.sex)==='Male'?'selected':''}>Male</option><option value="Female" ${normalizeSex(p.sex)==='Female'?'selected':''}>Female</option></select></div><div class="field"><label for="newPatientProcedure">Surgery / Procedure</label><input id="newPatientProcedure" required value="${escapeHtml(p.procedure || '')}" placeholder="e.g. Appendectomy"></div><div class="field"><label for="newPatientDate">Surgery date</label><input id="newPatientDate" type="date" required value="${escapeHtml(p.surgeryDate || '')}"></div><div class="field"><label for="newPatientProgress">Care-plan completion (%)</label><input id="newPatientProgress" type="number" min="0" max="100" value="${escapeHtml(p.progress ?? 10)}"></div></div><div class="form-actions"><button type="button" class="btn btn-outline" data-modal-close>Cancel</button><button type="submit" class="btn btn-primary">${isEdit?'Save changes':'Add patient'}</button></div><p class="muted">${isEdit?'Update the selected patient record.':'A patient demo login will be created with the password 123456 when the email is new.'}</p></form>`;
  openModal(isEdit ? 'Edit Patient Details' : 'Add New Patient', body);
  $('patientForm').addEventListener('submit', event => {
    event.preventDefault();
    const name = $('newPatientName').value.trim();
    const email = $('newPatientEmail').value.trim().toLowerCase();
    const procedure = $('newPatientProcedure').value.trim();
    const surgeryDate = $('newPatientDate').value;
    const progress = Number($('newPatientProgress').value);
    const sex = normalizeSex($('newPatientSex').value);
    if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !procedure || !surgeryDate || !Number.isFinite(progress) || progress < 0 || progress > 100) {
      showToast('Complete all required patient details with valid values.'); return;
    }
    const patients = getPatients();
    if (isEdit) {
      const target = patients.find(item => item.id === p.id);
      if (!target) return;
      Object.assign(target, { name, phone:$('newPatientPhone').value.trim(), sex, procedure, surgeryDate, progress });
      const linkedUsers = getUsers();
      const linkedUser = linkedUsers.find(user => String(user.email).toLowerCase() === email);
      if (linkedUser) { linkedUser.sex = sex; linkedUser.name = name; linkedUser.phone = $('newPatientPhone').value.trim(); linkedUser.surgery = procedure; linkedUser.surgeryDate = surgeryDate; saveUsers(linkedUsers); }
      selectedPatientId = target.id;
      savePatients(patients);
      closeModal(); renderApp(); showToast('Patient details updated.'); return;
    }
    if (patients.some(item => item.email.toLowerCase() === email)) { showToast('A patient with this email already exists.'); return; }
    const newPatient = { id:newId('PO'), name, email, phone:$('newPatientPhone').value.trim(), sex, procedure, surgeryDate, progress, status:'New patient', nextAppointment:'To be scheduled', needsFollowup:false, reviewed:false, assignedDoctor:currentUser.name, assignedDoctorEmail:currentUser.email };
    patients.unshift(newPatient); savePatients(patients); selectedPatientId = newPatient.id;
    const users = getUsers();
    if (!users.some(user => user.email.toLowerCase() === email)) users.push({ name, email, password:'123456', role:'patient', phone:newPatient.phone, sex, surgery:procedure, surgeryDate, assignedDoctorEmail:currentUser.email });
    else users.forEach(user => { if (user.email.toLowerCase() === email) user.sex = sex; });
    saveUsers(users);
    closeModal(); navigate('Patient Details & Reports'); showToast('Patient added. Demo password: 123456.');
  });
}

// Global shell controls.
$('logoutButton').addEventListener('click', logout);
$('notificationButton').addEventListener('click', openAlertsModal);
$('switchRoleButton').addEventListener('click', switchDemoRole);
$('mobileMenu').addEventListener('click', () => $('sidebar').classList.toggle('open'));
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeModal(); });

initializeDemoData();
setupAuth();
const rememberedEmailOnLoad = (() => { try { return localStorage.getItem('postop_remembered_email') || 'doctor@postopcare.com'; } catch { return 'doctor@postopcare.com'; } })();
$('authEmail').value = rememberedEmailOnLoad;
const rememberedAccountOnLoad = getUsers().find(user => String(user.email).toLowerCase() === rememberedEmailOnLoad.toLowerCase());
if (rememberedAccountOnLoad) {
  selectedRole = rememberedAccountOnLoad.role;
  document.querySelectorAll('.role-choice').forEach(item => item.classList.toggle('active', item.dataset.role === selectedRole));
}
