const API_BASE = "https://maktab4lifeworker.maktab4life.workers.dev";

const state = {
  portalType: null,
  uniqueid: null,
  token: localStorage.getItem("maktab_token") || "",
  userType: localStorage.getItem("maktab_user_type") || "",
  user: null
};

window.addEventListener("load", initApp);

function initApp() {
  const path = window.location.pathname;
  const parts = path.split("/").filter(Boolean);

  if (parts[0] === "admin" && parts[1]) {
    state.portalType = "admin";
    state.uniqueid = parts[1];
    checkAdmin();
    return;
  }

  if (parts[0] === "u" && parts[1]) {
    state.portalType = "student";
    state.uniqueid = parts[1];
    checkStudent();
    return;
  }

  document.getElementById("portal-title").innerText = "UmmAbbad Academy";
  document.getElementById("portal-subtitle").innerText =
    "Please open your personal login link.";
}

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(screen => {
    screen.classList.remove("active");
  });

  document.getElementById(id).classList.add("active");
}

function setError(message) {
  document.getElementById("auth-error").innerText = message || "";
}

async function apiPost(path, body = {}, token = "") {
  const headers = {
    "Content-Type": "application/json"
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  return response.json();
}

async function checkStudent() {
  try {
    const result = await apiPost("/api/check-student", {
      uniqueid: state.uniqueid
    });

    if (!result.success) {
      setError(result.error || "Invalid student link");
      return;
    }

    state.user = result.student;

    document.getElementById("portal-title").innerText = "Student Portal";
    document.getElementById("portal-subtitle").innerText =
      `Welcome ${result.student.username}`;

    if (result.student.pinsetup === true) {
      document.getElementById("login-pin-box").classList.remove("hidden");
    } else {
      document.getElementById("setup-pin-box").classList.remove("hidden");
    }
  } catch (err) {
    setError("Unable to connect. Please try again.");
  }
}

async function checkAdmin() {
  try {
    const result = await apiPost("/api/admin/check-admin", {
      uniqueid: state.uniqueid
    });

    if (!result.success) {
      setError(result.error || "Invalid admin link");
      return;
    }

    state.user = result.admin;

    document.getElementById("portal-title").innerText = "Staff Portal";
    document.getElementById("portal-subtitle").innerText =
      `${result.admin.username} · ${result.admin.role}`;

    document.body.classList.add("admin-body");

    if (result.admin.pinsetup === true) {
      document.getElementById("login-pin-box").classList.remove("hidden");
    } else {
      document.getElementById("setup-pin-box").classList.remove("hidden");
    }
  } catch (err) {
    setError("Unable to connect. Please try again.");
  }
}

async function submitSetupPin() {
  const pin = document.getElementById("setup-pin").value.trim();

  if (!/^\d{4}$/.test(pin)) {
    setError("PIN must be 4 digits.");
    return;
  }

  const path = state.portalType === "admin"
    ? "/api/admin/setup-pin"
    : "/api/setup-pin";

  const result = await apiPost(path, {
    uniqueid: state.uniqueid,
    pin
  });

  if (!result.success) {
    setError(result.error || "Could not set PIN.");
    return;
  }

  document.getElementById("setup-pin-box").classList.add("hidden");
  document.getElementById("login-pin-box").classList.remove("hidden");
  setError("");
}

async function submitLogin() {
  const pin = document.getElementById("login-pin").value.trim();

  if (!/^\d{4}$/.test(pin)) {
    setError("PIN must be 4 digits.");
    return;
  }

  const path = state.portalType === "admin"
    ? "/api/admin/login"
    : "/api/login";

  const result = await apiPost(path, {
    uniqueid: state.uniqueid,
    pin
  });

  if (!result.success) {
    setError(result.error || "Login failed.");
    return;
  }

  state.token = result.token;
  state.userType = state.portalType;
  state.user = state.portalType === "admin" ? result.admin : result.student;

  localStorage.setItem("maktab_token", state.token);
  localStorage.setItem("maktab_user_type", state.userType);

  if (state.portalType === "admin") {
    document.getElementById("admin-welcome").innerText =
      `${result.admin.username} · ${result.admin.role}`;
    showScreen("admin-home");
  } else {
    document.getElementById("student-welcome").innerText =
      `${result.student.username} · ${result.student.classgroup}`;
    showScreen("student-home");
  }
}

function logout() {
  localStorage.removeItem("maktab_token");
  localStorage.removeItem("maktab_user_type");
  location.reload();
}

function goHome() {
  if (state.userType === "admin" || state.portalType === "admin") {
    showScreen("admin-home");
  } else {
    showScreen("student-home");
  }
}

function showPlaceholder(title) {
  document.getElementById("placeholder-title").innerText = title;
  showScreen("placeholder-screen");
}

function showAdminAcademics() {
  showScreen("admin-academics");
}

async function showStudentTasks() {
  showScreen("student-tasks");

  const container = document.getElementById("student-task-list");
  container.innerHTML = `<p class="helper-text">Loading tasks...</p>`;

  const result = await apiPost("/api/tasks/student", {
    subjectid: "ALL"
  }, state.token);

  if (!result.success) {
    container.innerHTML = `<p class="error-message">${result.error || "Failed to load tasks"}</p>`;
    return;
  }

  if (result.tasks.length === 0) {
    container.innerHTML = `<p class="helper-text">No tasks assigned yet.</p>`;
    return;
  }

  const grouped = groupTasksBySubject(result.tasks);

  let html = "";

  Object.keys(grouped).forEach(subjectName => {
    const subjectTasks = grouped[subjectName];
    const completed = subjectTasks.filter(t => t.completestatus).length;
    const total = subjectTasks.length;
    const percentDone = total === 0 ? 0 : Math.round((completed / total) * 100);

    html += `
      <div class="subject-heading">
        ${escapeHtml(subjectName)}
      </div>

      <div class="mini-progress-box">
        <div class="mini-progress-number">${percentDone}%</div>
        <div class="mini-text">Completed</div>
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill" style="width:${percentDone}%"></div>
        </div>
      </div>
    `;

    subjectTasks.forEach(task => {
      const isComplete = !!task.completestatus;
      const isVerified = !!task.verifystatus;

      html += `
        <div class="task-card">
          <div class="task-title">${escapeHtml(task.taskname)}</div>

          <div class="task-status-row">
            <span class="status-pill">
              ${isComplete ? "COMPLETE" : "TO BE COMPLETED"}
            </span>

            <span class="status-pill">
              ${isVerified ? "VERIFIED" : "NOT VERIFIED"}
            </span>
          </div>

          ${renderTaskLinks(task)}

          <div class="task-actions">
            <button onclick="toggleStudentTask('${task.studenttaskid}', ${isComplete ? "false" : "true"})">
              ${isComplete ? "Mark Not Complete" : "Mark Complete"}
            </button>
          </div>
        </div>
      `;
    });
  });

  container.innerHTML = html;
}




async function toggleStudentTask(studenttaskid, complete) {
  const result = await apiPost("/api/tasks/update-complete", {
    studenttaskid,
    complete
  }, state.token);

  if (!result.success) {
    alert(result.error || "Could not update task.");
    return;
  }

  showStudentTasks();
}

function showProgressReport() {
  showScreen("progress-report");
}

async function loadProgressReport() {
  const output = document.getElementById("progress-output");
  output.innerHTML = `<p class="helper-text">Loading report...</p>`;

  const result = await apiPost("/api/progress/tasks", {
    studentid: "ALL",
    classgroup: "ALL",
    subjectid: "ALL"
  }, state.token);

  if (!result.success) {
    output.innerHTML = `<p class="error-message">${result.error || "Failed to load progress"}</p>`;
    return;
  }

  output.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-number">${result.summary.completedPercent}%</div>
        <div class="mini-text">Completed</div>
      </div>

      <div class="stat-card">
        <div class="stat-number">${result.summary.verifiedPercent}%</div>
        <div class="mini-text">Verified</div>
      </div>
    </div>

    <div class="dashboard-section">
      <h3>Groups</h3>
      ${
        result.groups.length
          ? result.groups.map(group => `
            <div class="task-card admin-task-card">
              <div class="task-title">${escapeHtml(group.classgroup)}</div>
              <div class="task-meta">Completed: ${group.completedPercent}%</div>
              <div class="task-meta">Verified: ${group.verifiedPercent}%</div>
              <div class="progress-bar-wrap">
                <div class="progress-bar-fill" style="width:${group.verifiedPercent}%"></div>
              </div>
            </div>
          `).join("")
          : `<p class="helper-text">No group data yet.</p>`
      }
    </div>

    <div class="dashboard-section">
      <h3>Students</h3>
      ${
        result.students.length
          ? result.students.map(student => `
            <div class="task-card admin-task-card clickable-card" onclick="openTeacherStudentTasks('${student.studentid}', '${escapeForAttribute(student.username)}')">
              <div class="task-title">${escapeHtml(student.username)}</div>
              <div class="task-meta">${escapeHtml(student.classgroup)}</div>

              <div class="mini-progress-grid">
                <div class="mini-progress-box">
                  <div class="mini-progress-number">${student.completedPercent}%</div>
                  <div class="mini-text">Completed</div>
                </div>

                <div class="mini-progress-box">
                  <div class="mini-progress-number">${student.verifiedPercent}%</div>
                  <div class="mini-text">Verified</div>
                </div>
              </div>
            </div>
          `).join("")
          : `<p class="helper-text">No student data yet.</p>`
      }
    </div>
  `;
}


async function openTeacherStudentTasks(studentid, username) {
  showScreen("teacher-student-tasks");

  document.getElementById("teacher-student-tasks-title").innerText =
    username ? `${username}'s Tasks` : "Student Tasks";

  const container = document.getElementById("teacher-student-task-list");
  container.innerHTML = `<p class="helper-text">Loading tasks...</p>`;

  const result = await apiPost("/api/tasks/student", {
    studentid,
    subjectid: "ALL"
  }, state.token);

  if (!result.success) {
    container.innerHTML = `<p class="error-message">${result.error || "Failed to load tasks"}</p>`;
    return;
  }

  if (result.tasks.length === 0) {
    container.innerHTML = `<p class="helper-text">No tasks assigned to this student.</p>`;
    return;
  }

  const grouped = groupTasksBySubject(result.tasks);

  let html = "";

  Object.keys(grouped).forEach(subjectName => {
    html += `
      <div class="subject-heading">
        ${escapeHtml(subjectName)}
      </div>
    `;

    grouped[subjectName].forEach(task => {
      const isComplete = !!task.completestatus;
      const isVerified = !!task.verifystatus;

      html += `
        <div class="task-card admin-task-card">
          <div class="task-title">${escapeHtml(task.taskname)}</div>

          <div class="task-status-row">
            <span class="status-pill">
              ${isComplete ? "COMPLETE" : "TO BE COMPLETED"}
            </span>

            <span class="status-pill">
              ${isVerified ? "VERIFIED" : "NOT VERIFIED"}
            </span>
          </div>

          ${renderTaskLinks(task)}

          <div class="task-actions">
            <button onclick="teacherToggleComplete('${task.studenttaskid}', ${isComplete ? "false" : "true"}, '${studentid}', '${escapeForAttribute(username)}')">
              ${isComplete ? "Mark Not Complete" : "Mark Complete"}
            </button>

            <button onclick="teacherToggleVerified('${task.studenttaskid}', ${isVerified ? "false" : "true"}, '${studentid}', '${escapeForAttribute(username)}')">
              ${isVerified ? "Unverify" : "Verify"}
            </button>
          </div>
        </div>
      `;
    });
  });

  container.innerHTML = html;
}

async function teacherToggleComplete(studenttaskid, complete, studentid, username) {
  const result = await apiPost("/api/tasks/update-complete", {
    studenttaskid,
    complete
  }, state.token);

  if (!result.success) {
    alert(result.error || "Could not update task.");
    return;
  }

  openTeacherStudentTasks(studentid, username);
}

async function teacherToggleVerified(studenttaskid, verified, studentid, username) {
  const result = await apiPost("/api/admin/tasks/verify", {
    studenttaskid,
    verified
  }, state.token);

  if (!result.success) {
    alert(result.error || "Could not verify task.");
    return;
  }

  openTeacherStudentTasks(studentid, username);
}

function escapeForAttribute(value) {
  return String(value || "")
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'")
    .replaceAll('"', "&quot;");
}




let allSubjects = [];
let pendingSubjects = [];
let selectedSubject = null;
let selectedSubjectDraftActive = null;

async function showSubjectsScreen() {
  showScreen("subjects-screen");

  pendingSubjects = [];
  selectedSubject = null;
  selectedSubjectDraftActive = null;

  document.getElementById("subject-add-message").innerText = "";
  document.getElementById("modify-subject-box").classList.add("hidden");

  renderSubjectAddRows();
  await loadSubjectsForModify();
}

function renderSubjectAddRows() {
  const container = document.getElementById("subject-add-list");
  const submitBtn = document.getElementById("submit-subjects-btn");

  let html = "";

  pendingSubjects.forEach((name, index) => {
    html += `
      <div class="pending-subject-chip">
        <span>${escapeHtml(name)}</span>
        <button onclick="removePendingSubject(${index})">Remove</button>
      </div>
    `;
  });

  if (pendingSubjects.length < 5) {
    html += `
      <div class="subject-add-row">
        <input
          id="new-subject-input"
          type="text"
          placeholder="add a new subject"
          onkeydown="handleSubjectInputKey(event)"
        />
        <button class="enter-btn" onclick="addPendingSubject()">↵</button>
      </div>
    `;
  }

  container.innerHTML = html;

  if (pendingSubjects.length > 0) {
    submitBtn.classList.remove("hidden");
  } else {
    submitBtn.classList.add("hidden");
  }
}

function handleSubjectInputKey(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    addPendingSubject();
  }
}

function addPendingSubject() {
  const input = document.getElementById("new-subject-input");
  const subjectName = input ? input.value.trim() : "";

  if (!subjectName) {
    alert("Enter a subject name.");
    return;
  }

  if (pendingSubjects.length >= 5) {
    alert("You can add up to 5 subjects at once.");
    return;
  }

  const normalizedNew = normalizeClientText(subjectName);

  const duplicatePending = pendingSubjects.some(
    name => normalizeClientText(name) === normalizedNew
  );

  if (duplicatePending) {
    alert("This subject is already in your pending list.");
    return;
  }

  const duplicateExisting = allSubjects.some(
    subject => normalizeClientText(subject.subjectname) === normalizedNew
  );

  if (duplicateExisting) {
    alert("This subject already exists.");
    return;
  }

  pendingSubjects.push(subjectName);
  renderSubjectAddRows();

  setTimeout(() => {
    const nextInput = document.getElementById("new-subject-input");
    if (nextInput) nextInput.focus();
  }, 50);
}

function removePendingSubject(index) {
  pendingSubjects.splice(index, 1);
  renderSubjectAddRows();
}

async function submitPendingSubjects() {
  if (pendingSubjects.length === 0) {
    return;
  }

  const added = [];
  const failed = [];

  for (const subjectName of pendingSubjects) {
    const result = await apiPost("/api/admin/subjects/create", {
      subjectName
    }, state.token);

    if (result.success) {
      added.push(result.subject.subjectname);
    } else {
      failed.push({
        subjectName,
        error: result.error || "Failed"
      });
    }
  }

  if (added.length > 0) {
    document.getElementById("subject-add-message").innerText =
      `${added.join(", ")} ${added.length === 1 ? "has" : "have"} been added.`;
  }

  if (failed.length > 0) {
    alert(
      "Some subjects were not added:\n" +
      failed.map(f => `${f.subjectName}: ${f.error}`).join("\n")
    );
  }

  pendingSubjects = [];
  renderSubjectAddRows();
  await loadSubjectsForModify();
}

async function loadSubjectsForModify() {
  const select = document.getElementById("modify-subject-select");

  select.innerHTML = `<option value="">Loading subjects...</option>`;

  const result = await apiPost("/api/admin/subjects/list", {}, state.token);

  if (!result.success) {
    select.innerHTML = `<option value="">Failed to load subjects</option>`;
    return;
  }

  allSubjects = result.subjects || [];

  select.innerHTML = `<option value="">Select subject...</option>`;

  allSubjects.forEach(subject => {
    const status = subject.active === true ? "ACTIVE" : "INACTIVE";

    const option = document.createElement("option");
    option.value = subject.subjectid;
    option.textContent = `${subject.subjectname} — ${status}`;

    select.appendChild(option);
  });
}

function selectSubjectToModify() {
  const subjectid = document.getElementById("modify-subject-select").value;

  selectedSubject = allSubjects.find(subject => subject.subjectid === subjectid);

  const box = document.getElementById("modify-subject-box");

  if (!selectedSubject) {
    box.classList.add("hidden");
    selectedSubjectDraftActive = null;
    return;
  }

  selectedSubjectDraftActive = selectedSubject.active === true;

  document.getElementById("modify-subject-name").value = selectedSubject.subjectname;

  renderSelectedSubjectStatus();

  box.classList.remove("hidden");
}

function renderSelectedSubjectStatus() {
  const statusDisplay = document.getElementById("selected-subject-status");
  const statusBtn = document.getElementById("toggle-subject-status-btn");

  if (!selectedSubject) {
    statusDisplay.innerText = "STATUS: -";
    statusBtn.innerText = "Change Status";
    return;
  }

  statusDisplay.innerText = selectedSubjectDraftActive
    ? "STATUS: ACTIVE"
    : "STATUS: INACTIVE";

  statusBtn.innerText = selectedSubjectDraftActive
    ? "Make Inactive"
    : "Make Active";
}

function toggleSubjectStatusLocal() {
  if (!selectedSubject) {
    alert("Select a subject first.");
    return;
  }

  selectedSubjectDraftActive = !selectedSubjectDraftActive;
  renderSelectedSubjectStatus();
}

async function saveSubjectChanges() {
  if (!selectedSubject) {
    alert("Select a subject first.");
    return;
  }

  const subjectName = document.getElementById("modify-subject-name").value.trim();

  if (!subjectName) {
    alert("Subject name cannot be empty.");
    return;
  }

  const result = await apiPost("/api/admin/subjects/update", {
    subjectid: selectedSubject.subjectid,
    subjectName,
    active: selectedSubjectDraftActive
  }, state.token);

  if (!result.success) {
    alert(result.error || "Could not update subject.");
    return;
  }

  alert("Subject changes saved.");

  await loadSubjectsForModify();

  document.getElementById("modify-subject-box").classList.add("hidden");
  selectedSubject = null;
  selectedSubjectDraftActive = null;
}

function normalizeClientText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function groupTasksBySubject(tasks) {
  const grouped = {};

  tasks.forEach(task => {
    const subjectName = task.subjectname || "Other";

    if (!grouped[subjectName]) {
      grouped[subjectName] = [];
    }

    grouped[subjectName].push(task);
  });

  Object.keys(grouped).forEach(subjectName => {
    grouped[subjectName].sort((a, b) => {
      return String(a.taskname).localeCompare(String(b.taskname));
    });
  });

  return grouped;
}

function renderTaskLinks(task) {
  const links = [];

  if (task.pdflink) {
    links.push(`<a href="${escapeHtml(task.pdflink)}" target="_blank">PDF</a>`);
  }

  if (task.audiolink) {
    links.push(`<a href="${escapeHtml(task.audiolink)}" target="_blank">Audio</a>`);
  }

  if (task.videolink) {
    links.push(`<a href="${escapeHtml(task.videolink)}" target="_blank">Video</a>`);
  }

  if (task.visuallink) {
    links.push(`<a href="${escapeHtml(task.visuallink)}" target="_blank">Visual</a>`);
  }

  if (links.length === 0) {
    return "";
  }

  return `
    <div class="task-meta" style="margin-top:10px;">
      Resources: ${links.join(" · ")}
    </div>
  `;
}







function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
