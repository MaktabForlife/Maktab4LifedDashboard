const API_BASE = "https://maktab4lifeworker.maktab4life.workers.dev";
const TOKEN_KEY = "maktab_token";

let currentUserType = null;
let currentUniqueId = "";
let currentAdmin = null;
let currentStudent = null;

let adminSubjects = [];
let adminStudents = [];
let adminGroups = [];

let currentProgressRows = [];
let progressPendingUpdates = new Map();

let progressScope = {
  mode: "class",
  group: "",
  studentId: "",
  subject: "",
  taskId: ""
};

document.addEventListener("DOMContentLoaded", initApp);

function initApp() {
  const path = window.location.pathname;
  const parts = path.split("/").filter(Boolean);

  if (parts[0] === "admin" && parts[1]) {
    currentUserType = "admin";
    currentUniqueId = parts[1];
    renderAdminLogin();
    return;
  }

  if (parts[0] === "u" && parts[1]) {
    currentUserType = "student";
    currentUniqueId = parts[1];
    renderStudentLogin();
    return;
  }

  renderLanding();
}

/* =========================================================
   BASIC HELPERS
========================================================= */

function qs(selector) {
  return document.querySelector(selector);
}

function byId(id) {
  return document.getElementById(id);
}

function token() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

function setToken(value) {
  localStorage.setItem(TOKEN_KEY, value);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeJs(value) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'")
    .replaceAll('"', '\\"')
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "");
}

function normaliseBool(value) {
  return (
    value === true ||
    value === 1 ||
    String(value ?? "").toUpperCase() === "TRUE" ||
    String(value ?? "").toUpperCase() === "YES"
  );
}

function showMessage(message, type = "info") {
  const box = byId("messageBox");
  if (!box) {
    alert(message);
    return;
  }

  box.className = `message-box ${type}`;
  box.textContent = message;
  box.style.display = "block";
}

function clearMessage() {
  const box = byId("messageBox");
  if (!box) return;
  box.textContent = "";
  box.style.display = "none";
}

async function apiPost(path, body = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok || data.ok === false || data.success === false) {
    throw new Error(data.error || data.message || "API request failed");
  }

  return data;
}

function getApiRows(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.tasks)) return data.tasks;
  if (Array.isArray(data?.subjects)) return data.subjects;
  if (Array.isArray(data?.students)) return data.students;
  if (Array.isArray(data?.result?.rows)) return data.result.rows;
  if (Array.isArray(data?.result?.data)) return data.result.data;
  return [];
}

function appShell(content) {
  document.body.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="brand">
          <img src="/logo.png" alt="Maktab4Life" class="brand-logo">
          <div>
            <div class="brand-title">Maktab4Life</div>
            <div class="brand-subtitle">Learning Dashboard</div>
          </div>
        </div>
      </header>

      <main class="main-card">
        <div id="messageBox" class="message-box" style="display:none;"></div>
        ${content}
      </main>
    </div>
  `;
}

function dashboardShell(title, navHtml, contentHtml) {
  document.body.innerHTML = `
    <div class="dashboard-shell">
      <aside class="sidebar">
        <div class="sidebar-brand">
          <img src="/logo.png" alt="Maktab4Life" class="sidebar-logo">
          <div>
            <div class="brand-title">Maktab4Life</div>
            <div class="brand-subtitle">${escapeHtml(title)}</div>
          </div>
        </div>

        <nav class="side-nav">
          ${navHtml}
        </nav>

        <button class="logout-button" onclick="logout()">Logout</button>
      </aside>

      <main class="dashboard-main">
        <div id="messageBox" class="message-box" style="display:none;"></div>
        <div id="dashboardContent">
          ${contentHtml}
        </div>
      </main>
    </div>
  `;
}

function logout() {
  clearToken();

  if (currentUserType === "admin") {
    renderAdminLogin();
  } else {
    renderStudentLogin();
  }
}

/* =========================================================
   LANDING
========================================================= */

function renderLanding() {
  appShell(`
    <section class="login-card">
      <h1>Welcome to Maktab4Life</h1>
      <p>Please use your personal student or admin link.</p>
    </section>
  `);
}

/* =========================================================
   STUDENT AUTH
========================================================= */

async function renderStudentLogin() {
  clearMessage();

  appShell(`
    <section class="login-card">
      <h1>Student Login</h1>
      <p>Enter your PIN to open your dashboard.</p>

      <form onsubmit="studentLogin(event)">
        <label>PIN</label>
        <input id="studentPin" type="password" inputmode="numeric" maxlength="8" autocomplete="one-time-code" required>

        <button class="primary-button" type="submit">Login</button>
      </form>
    </section>
  `);

  try {
    const data = await apiPost("/api/check-student", {
      uniqueId: currentUniqueId
    });

    currentStudent = data.student || data.data || data;
  } catch (err) {
    showMessage(err.message || "Could not check student link.", "error");
  }
}

async function studentLogin(event) {
  event.preventDefault();
  clearMessage();

  const pin = byId("studentPin").value.trim();

  try {
    const data = await apiPost("/api/login", {
      uniqueId: currentUniqueId,
      pin
    });

    setToken(data.token || data.jwt || data.accessToken);
    currentStudent = data.student || data.data || currentStudent;

    renderStudentDashboard();
  } catch (err) {
    showMessage(err.message || "Login failed.", "error");
  }
}

/* =========================================================
   STUDENT DASHBOARD
========================================================= */

function renderStudentDashboard() {
  const nav = `
    <button onclick="showStudentTasks()" class="nav-button active">My Tasks</button>
  `;

  dashboardShell("Student Dashboard", nav, `
    <section class="screen">
      <h1>My Tasks</h1>
      <div id="studentTaskContent">Loading...</div>
    </section>
  `);

  showStudentTasks();
}

async function showStudentTasks() {
  setActiveNav("My Tasks");

  const container = byId("studentTaskContent") || byId("dashboardContent");
  container.innerHTML = `<p>Loading tasks...</p>`;

  try {
    const data = await apiPost("/api/tasks/student", {
      token: token()
    });

    const rows = getApiRows(data);
    renderStudentTasks(rows);
  } catch (err) {
    container.innerHTML = `<p class="error-text">${escapeHtml(err.message)}</p>`;
  }
}

function renderStudentTasks(rows) {
  const container = byId("studentTaskContent") || byId("dashboardContent");

  if (!rows.length) {
    container.innerHTML = `<p>No tasks assigned yet.</p>`;
    return;
  }

  const grouped = {};
  rows.forEach(row => {
    const subject = row.Subject || row.SubjectName || row.subject || "General";
    if (!grouped[subject]) grouped[subject] = [];
    grouped[subject].push(row);
  });

  container.innerHTML = Object.entries(grouped).map(([subject, tasks]) => `
    <section class="subject-task-group">
      <h2>${escapeHtml(subject)}</h2>

      <div class="task-list">
        ${tasks.map(task => {
          const taskId = task.TaskID || task.taskId || task.ID || task.id;
          const title = task.TaskTitle || task.Title || task.taskTitle || "Untitled task";
          const complete = normaliseBool(task.Completed || task.Complete || task.completed);

          return `
            <article class="task-card">
              <div>
                <h3>${escapeHtml(title)}</h3>
                ${task.Description ? `<p>${escapeHtml(task.Description)}</p>` : ""}
              </div>

              <button
                class="status-toggle ${complete ? "is-complete" : "is-off"}"
                onclick="studentToggleComplete('${escapeJs(taskId)}', ${complete ? "false" : "true"})"
              >
                ${complete ? "✓ Complete" : "Mark Complete"}
              </button>
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `).join("");
}

async function studentToggleComplete(taskId, completed) {
  try {
    await apiPost("/api/tasks/update-complete", {
      token: token(),
      taskId,
      completed
    });

    await showStudentTasks();
  } catch (err) {
    showMessage(err.message || "Could not update task.", "error");
  }
}

/* =========================================================
   ADMIN AUTH
========================================================= */

async function renderAdminLogin() {
  clearMessage();

  appShell(`
    <section class="login-card">
      <h1>Admin Login</h1>
      <p>Enter your admin PIN to open the dashboard.</p>

      <form onsubmit="adminLogin(event)">
        <label>PIN</label>
        <input id="adminPin" type="password" inputmode="numeric" maxlength="8" autocomplete="one-time-code" required>

        <button class="primary-button" type="submit">Login</button>
      </form>
    </section>
  `);

  try {
    const data = await apiPost("/api/admin/check-admin", {
      uniqueId: currentUniqueId
    });

    currentAdmin = data.admin || data.data || data;
  } catch (err) {
    showMessage(err.message || "Could not check admin link.", "error");
  }
}

async function adminLogin(event) {
  event.preventDefault();
  clearMessage();

  const pin = byId("adminPin").value.trim();

  try {
    const data = await apiPost("/api/admin/login", {
      uniqueId: currentUniqueId,
      pin
    });

    setToken(data.token || data.jwt || data.accessToken);
    currentAdmin = data.admin || data.data || currentAdmin;

    renderAdminDashboard();
  } catch (err) {
    showMessage(err.message || "Login failed.", "error");
  }
}

/* =========================================================
   ADMIN DASHBOARD
========================================================= */

function renderAdminDashboard() {
  const nav = `
    <button onclick="showAdminHome()" class="nav-button active">Home</button>
    <button onclick="showSubjectsScreen()" class="nav-button">Subjects</button>
    <button onclick="showAcademicsScreen()" class="nav-button">Academics</button>
    <button onclick="showAttendanceScreen()" class="nav-button">Attendance</button>
  `;

  dashboardShell("Admin Dashboard", nav, `
    <section class="screen">
      <h1>Admin Dashboard</h1>
      <p>Select a section from the menu.</p>
    </section>
  `);
}

function setActiveNav(label) {
  document.querySelectorAll(".nav-button").forEach(button => {
    button.classList.toggle("active", button.textContent.trim() === label);
  });
}

function showAdminHome() {
  setActiveNav("Home");

  byId("dashboardContent").innerHTML = `
    <section class="screen">
      <h1>Admin Dashboard</h1>
      <p>Select a section from the menu.</p>
    </section>
  `;
}

/* =========================================================
   SUBJECTS
========================================================= */

async function showSubjectsScreen() {
  setActiveNav("Subjects");

  byId("dashboardContent").innerHTML = `
    <section class="screen">
      <div class="screen-header">
        <div>
          <h1>Subjects</h1>
          <p>Add and manage up to 5 active subjects.</p>
        </div>
      </div>

      <form class="inline-form" onsubmit="createSubject(event)">
        <input id="newSubjectName" placeholder="Subject name" required>
        <button class="primary-button" type="submit">Add Subject</button>
      </form>

      <div id="subjectsContent">Loading...</div>
    </section>
  `;

  await loadSubjects();
}

async function loadSubjects() {
  const container = byId("subjectsContent");

  try {
    const data = await apiPost("/api/admin/subjects/list", {
      token: token()
    });

    adminSubjects = getApiRows(data);
    renderSubjects();
  } catch (err) {
    container.innerHTML = `<p class="error-text">${escapeHtml(err.message)}</p>`;
  }
}

function renderSubjects() {
  const container = byId("subjectsContent");

  if (!adminSubjects.length) {
    container.innerHTML = `<p>No subjects yet.</p>`;
    return;
  }

  container.innerHTML = `
    <div class="record-list">
      ${adminSubjects.map(subject => {
        const id = subject.SubjectID || subject.ID || subject.id || subject.subjectId;
        const name = subject.SubjectName || subject.Name || subject.name || "";
        const active = normaliseBool(subject.Active ?? subject.active ?? true);

        return `
          <article class="record-card">
            <input id="subjectName_${escapeHtml(id)}" value="${escapeHtml(name)}">
            <select id="subjectActive_${escapeHtml(id)}">
              <option value="TRUE" ${active ? "selected" : ""}>Active</option>
              <option value="FALSE" ${!active ? "selected" : ""}>Inactive</option>
            </select>
            <button class="secondary-button" onclick="updateSubject('${escapeJs(id)}')">Save</button>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

async function createSubject(event) {
  event.preventDefault();

  const name = byId("newSubjectName").value.trim();
  if (!name) return;

  if (adminSubjects.filter(s => normaliseBool(s.Active ?? s.active ?? true)).length >= 5) {
    showMessage("You can only have up to 5 active subjects.", "error");
    return;
  }

  try {
    await apiPost("/api/admin/subjects/create", {
      token: token(),
      subjectName: name,
      active: true
    });

    byId("newSubjectName").value = "";
    await loadSubjects();
  } catch (err) {
    showMessage(err.message || "Could not create subject.", "error");
  }
}

async function updateSubject(subjectId) {
  const name = byId(`subjectName_${subjectId}`)?.value?.trim();
  const active = byId(`subjectActive_${subjectId}`)?.value === "TRUE";

  try {
    await apiPost("/api/admin/subjects/update", {
      token: token(),
      subjectId,
      subjectName: name,
      active
    });

    await loadSubjects();
    showMessage("Subject updated.", "success");
  } catch (err) {
    showMessage(err.message || "Could not update subject.", "error");
  }
}

/* =========================================================
   ATTENDANCE PLACEHOLDER
========================================================= */

function showAttendanceScreen() {
  setActiveNav("Attendance");

  byId("dashboardContent").innerHTML = `
    <section class="screen">
      <h1>Attendance</h1>
      <p>Attendance tools can be connected here.</p>
    </section>
  `;
}

/* =========================================================
   ACADEMICS / PROGRESS HOME
========================================================= */

function showAcademicsScreen() {
  setActiveNav("Academics");

  progressPendingUpdates.clear();
  currentProgressRows = [];

  byId("dashboardContent").innerHTML = `
    <section class="screen">
      <div class="screen-header">
        <div>
          <h1>Academic Progress</h1>
          <p>View progress by full class, group, or individual student.</p>
        </div>
      </div>

      <div id="progressContent">
        ${renderProgressHomeHtml()}
      </div>
    </section>
  `;

  loadProgressSelectors();
}

function showProgressHome() {
  progressPendingUpdates.clear();
  progressScope = {
    mode: "class",
    group: "",
    studentId: "",
    subject: "",
    taskId: ""
  };

  const container = byId("progressContent");
  if (container) {
    container.innerHTML = renderProgressHomeHtml();
    loadProgressSelectors();
  }
}

function renderProgressHomeHtml() {
  return `
    <div class="progress-home-grid">
      <article class="progress-home-card">
        <h2>Full Class</h2>
        <p>View all students across all groups.</p>
        <button class="primary-button" onclick="loadProgressClass()">View Full Class</button>
      </article>

      <article class="progress-home-card">
        <h2>Group</h2>
        <p>Select a class group.</p>
        <select id="progressGroupSelect">
          <option value="">Loading groups...</option>
        </select>
        <button class="primary-button" onclick="loadSelectedProgressGroup()">View Group</button>
      </article>

      <article class="progress-home-card">
        <h2>Student</h2>
        <p>Select an individual student.</p>
        <select id="progressStudentSelect">
          <option value="">Loading students...</option>
        </select>
        <button class="primary-button" onclick="loadSelectedProgressStudent()">View Student</button>
      </article>
    </div>
  `;
}

async function loadProgressSelectors() {
  try {
    const data = await apiPost("/api/progress/task-detail", {
      token: token(),
      scope: "class"
    });

    const rows = getApiRows(data);
    const studentsMap = new Map();
    const groupsSet = new Set();

    rows.forEach(row => {
      const studentId = getRowStudentId(row);
      const studentName = getRowStudentName(row);
      const group = getRowGroup(row);

      if (studentId) {
        studentsMap.set(studentId, {
          id: studentId,
          name: studentName,
          group
        });
      }

      if (group) groupsSet.add(group);
    });

    adminStudents = Array.from(studentsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    adminGroups = Array.from(groupsSet).sort();

    const groupSelect = byId("progressGroupSelect");
    if (groupSelect) {
      groupSelect.innerHTML = `
        <option value="">Select group</option>
        ${adminGroups.map(group => `
          <option value="${escapeHtml(group)}">${escapeHtml(group)}</option>
        `).join("")}
      `;
    }

    const studentSelect = byId("progressStudentSelect");
    if (studentSelect) {
      studentSelect.innerHTML = `
        <option value="">Select student</option>
        ${adminStudents.map(student => `
          <option value="${escapeHtml(student.id)}">
            ${escapeHtml(student.name)}${student.group ? ` — ${escapeHtml(student.group)}` : ""}
          </option>
        `).join("")}
      `;
    }
  } catch (err) {
    showMessage(err.message || "Could not load progress selectors.", "error");
  }
}

function loadSelectedProgressGroup() {
  const group = byId("progressGroupSelect")?.value || "";
  if (!group) {
    showMessage("Please select a group.", "error");
    return;
  }

  loadProgressGroup(group);
}

function loadSelectedProgressStudent() {
  const studentId = byId("progressStudentSelect")?.value || "";
  if (!studentId) {
    showMessage("Please select a student.", "error");
    return;
  }

  loadProgressStudent(studentId);
}

/* =========================================================
   PROGRESS LOADING
========================================================= */

async function loadProgressClass() {
  progressScope = {
    mode: "class",
    group: "",
    studentId: "",
    subject: "",
    taskId: ""
  };

  progressPendingUpdates.clear();

  const container = byId("progressContent");
  if (container) container.innerHTML = `<p>Loading class progress...</p>`;

  try {
    const data = await apiPost("/api/progress/task-detail", {
      token: token(),
      scope: "class"
    });

    currentProgressRows = getApiRows(data);
    renderProgressSubjectButtons(currentProgressRows);
  } catch (err) {
    container.innerHTML = `<p class="error-text">${escapeHtml(err.message)}</p>`;
  }
}

async function loadProgressGroup(group) {
  progressScope = {
    mode: "group",
    group,
    studentId: "",
    subject: "",
    taskId: ""
  };

  progressPendingUpdates.clear();

  const container = byId("progressContent");
  if (container) container.innerHTML = `<p>Loading group progress...</p>`;

  try {
    const data = await apiPost("/api/progress/task-detail", {
      token: token(),
      scope: "group",
      group
    });

    currentProgressRows = getApiRows(data);
    renderProgressSubjectButtons(currentProgressRows);
  } catch (err) {
    container.innerHTML = `<p class="error-text">${escapeHtml(err.message)}</p>`;
  }
}

async function loadProgressStudent(studentId) {
  progressScope = {
    mode: "student",
    group: "",
    studentId,
    subject: "",
    taskId: ""
  };

  progressPendingUpdates.clear();

  const container = byId("progressContent");
  if (container) container.innerHTML = `<p>Loading student progress...</p>`;

  try {
    const data = await apiPost("/api/progress/task-detail", {
      token: token(),
      scope: "student",
      studentId
    });

    currentProgressRows = getApiRows(data);

    if (!currentProgressRows.length) {
      container.innerHTML = `
        <div class="progress-header-row">
          <button class="secondary-button" onclick="showProgressHome()">Back</button>
          <h3>Student Progress</h3>
        </div>
        <p>No tasks found for this student.</p>
      `;
      return;
    }

    renderIndividualStudentTaskList(currentProgressRows);
  } catch (err) {
    container.innerHTML = `<p class="error-text">${escapeHtml(err.message)}</p>`;
  }
}

/* =========================================================
   PROGRESS DATA HELPERS
========================================================= */

function progressKey(row) {
  return `${getRowStudentId(row)}::${getRowTaskId(row)}`;
}

function getRowStudentId(row) {
  return (
    row.StudentID ||
    row.StudentId ||
    row.studentId ||
    row.studentid ||
    row.student_id ||
    row.StudentUniqueID ||
    row.StudentUniqueId ||
    row.UniqueID ||
    row.uniqueId ||
    ""
  );
}

function getRowTaskId(row) {
  return (
    row.TaskID ||
    row.TaskId ||
    row.taskId ||
    row.taskid ||
    row.task_id ||
    row.ID ||
    row.Id ||
    row.id ||
    ""
  );
}

function getRowStudentName(row) {
  return (
    row.StudentName ||
    row.studentName ||
    row.student_name ||
    row.Username ||
    row.UserName ||
    row.Name ||
    row.name ||
    "Unnamed student"
  );
}

function getRowGroup(row) {
  return (
    row.Group ||
    row.ClassGroup ||
    row.classGroup ||
    row.classgroup ||
    row.class_group ||
    row.group ||
    "Ungrouped"
  );
}

function getRowSubject(row) {
  return (
    row.Subject ||
    row.SubjectName ||
    row.subjectName ||
    row.subject ||
    row.subject_name ||
    "Unassigned"
  );
}

function getRowTaskTitle(row) {
  return (
    row.TaskTitle ||
    row.TaskName ||
    row.Title ||
    row.taskTitle ||
    row.taskName ||
    row.task_title ||
    row.task_name ||
    row.task ||
    "Untitled task"
  );
}

function isComplete(row) {
  return normaliseBool(row.Completed ?? row.Complete ?? row.CompletionStatus ?? row.completed ?? row.complete ?? row.isComplete);
}

function isVerified(row) {
  return normaliseBool(row.Verified ?? row.VerifiedStatus ?? row.verified ?? row.verify ?? row.isVerified);
}

function pct(done, total) {
  if (!total) return 0;
  return Math.round((done / total) * 100);
}

function summariseRows(rows) {
  const total = rows.length;
  const complete = rows.filter(isComplete).length;
  const verified = rows.filter(isVerified).length;

  return {
    total,
    complete,
    verified,
    completePercent: pct(complete, total),
    verifiedPercent: pct(verified, total)
  };
}

function renderProgressBars(completedPercent, verifiedPercent) {
  return `
    <div class="dual-progress" aria-label="Progress">
      <div class="progress-line">
        <span class="progress-label">Complete</span>
        <span class="progress-track">
          <span class="progress-fill progress-fill-complete" style="width:${completedPercent}%"></span>
        </span>
      </div>

      <div class="progress-line">
        <span class="progress-label">Verified</span>
        <span class="progress-track">
          <span class="progress-fill progress-fill-verified" style="width:${verifiedPercent}%"></span>
        </span>
      </div>
    </div>
  `;
}

function setProgressPending(row, field, value) {
  const key = progressKey(row);

  const existing = progressPendingUpdates.get(key) || {
    studentId: getRowStudentId(row),
    taskId: getRowTaskId(row)
  };

  existing[field] = value;
  progressPendingUpdates.set(key, existing);
}

function applyPendingToRow(row) {
  const pending = progressPendingUpdates.get(progressKey(row));
  if (!pending) return row;

  return {
    ...row,
    Completed: typeof pending.completed === "boolean" ? pending.completed : isComplete(row),
    Verified: typeof pending.verified === "boolean" ? pending.verified : isVerified(row)
  };
}

function getVisibleProgressRows() {
  return currentProgressRows.map(applyPendingToRow);
}

/* =========================================================
   PROGRESS SUBJECT / TASK DRILLDOWN
========================================================= */

function renderProgressSubjectButtons(rows) {
  const container = byId("progressContent");
  if (!container) return;

  const visibleRows = rows.map(applyPendingToRow);

  if (!visibleRows.length) {
    container.innerHTML = `
      <div class="progress-header-row">
        <button class="secondary-button" onclick="showProgressHome()">Back</button>
        <h3>Progress</h3>
      </div>
      <p>No progress records found.</p>
    `;
    return;
  }

  const grouped = {};

  visibleRows.forEach(row => {
    const subject = getRowSubject(row);
    if (!grouped[subject]) grouped[subject] = [];
    grouped[subject].push(row);
  });

  const heading =
    progressScope.mode === "group"
      ? `Progress: ${progressScope.group}`
      : "Progress: Full Class";

  container.innerHTML = `
    <div class="progress-header-row">
      <button class="secondary-button" onclick="showProgressHome()">Back</button>
      <h3>${escapeHtml(heading)}</h3>
    </div>

    <div class="progress-button-list">
      ${Object.entries(grouped).map(([subject, subjectRows]) => {
        const summary = summariseRows(subjectRows);

        return `
          <button class="progress-drill-button" onclick="openProgressSubject('${escapeJs(subject)}')">
            <span class="progress-button-title">${escapeHtml(subject)}</span>
            ${renderProgressBars(summary.completePercent, summary.verifiedPercent)}
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function openProgressSubject(subject) {
  progressScope.subject = subject;
  progressScope.taskId = "";

  const rows = getVisibleProgressRows().filter(row => getRowSubject(row) === subject);
  renderProgressTaskButtons(rows);
}

function renderProgressTaskButtons(rows) {
  const container = byId("progressContent");
  if (!container) return;

  const grouped = {};

  rows.forEach(row => {
    const taskId = getRowTaskId(row) || getRowTaskTitle(row);
    if (!grouped[taskId]) grouped[taskId] = [];
    grouped[taskId].push(row);
  });

  container.innerHTML = `
    <div class="progress-header-row">
      <button class="secondary-button" onclick="renderProgressSubjectButtons(getVisibleProgressRows())">Back</button>
      <h3>${escapeHtml(progressScope.subject)}</h3>
    </div>

    <div class="progress-button-list">
      ${Object.entries(grouped).map(([taskId, taskRows]) => {
        const summary = summariseRows(taskRows);
        const title = getRowTaskTitle(taskRows[0]);

        return `
          <button class="progress-drill-button" onclick="openProgressTask('${escapeJs(taskId)}')">
            <span class="progress-button-title">${escapeHtml(title)}</span>
            ${renderProgressBars(summary.completePercent, summary.verifiedPercent)}
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function openProgressTask(taskId) {
  progressScope.taskId = taskId;

  const rows = getVisibleProgressRows().filter(row => (getRowTaskId(row) || getRowTaskTitle(row)) === taskId);
  renderProgressTaskStudents(rows);
}

/* =========================================================
   PROGRESS TASK STUDENT STATUS LIST
========================================================= */

function renderProgressTaskStudents(rows) {
  const container = byId("progressContent");
  if (!container) return;

  const grouped = {};

  rows.forEach(row => {
    const group = getRowGroup(row);
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(row);
  });

  const taskTitle = rows[0] ? getRowTaskTitle(rows[0]) : "Student Status";

  container.innerHTML = `
    <div class="progress-header-row">
      <button class="secondary-button" onclick="openProgressSubject('${escapeJs(progressScope.subject)}')">Back</button>
      <h3>${escapeHtml(taskTitle)}</h3>
    </div>

    ${Object.entries(grouped).map(([group, groupRows]) => `
      <section class="progress-group-block">
        <h4>${escapeHtml(group)}</h4>

        <div class="progress-student-list">
          ${groupRows.map(row => renderProgressStudentStatusRow(row)).join("")}
        </div>
      </section>
    `).join("")}

    <button class="primary-button save-progress-button" onclick="saveProgressPendingChanges()">
      Save Changes
    </button>
  `;
}

function renderProgressStudentStatusRow(row) {
  const complete = isComplete(row);
  const verified = isVerified(row);
  const key = progressKey(row);

  return `
    <div class="progress-student-row">
      <div class="progress-student-name">${escapeHtml(getRowStudentName(row))}</div>

      <button
        class="status-toggle ${complete ? "is-complete" : "is-off"}"
        onclick="toggleProgressStatus('${escapeJs(key)}', 'completed')"
      >
        ${complete ? "✓ Complete" : "Incomplete"}
      </button>

      <button
        class="status-toggle ${verified ? "is-verified" : "is-off"}"
        onclick="toggleProgressStatus('${escapeJs(key)}', 'verified')"
      >
        ${verified ? "✓ Verified" : "Unverified"}
      </button>
    </div>
  `;
}

function toggleProgressStatus(key, field) {
  const sourceRow = getVisibleProgressRows().find(row => progressKey(row) === key);
  if (!sourceRow) return;

  const newValue = field === "completed" ? !isComplete(sourceRow) : !isVerified(sourceRow);
  setProgressPending(sourceRow, field, newValue);

  if (progressScope.mode === "student") {
    renderIndividualStudentTaskList(getVisibleProgressRows());
    return;
  }

  if (progressScope.taskId) {
    const rows = getVisibleProgressRows().filter(row => (getRowTaskId(row) || getRowTaskTitle(row)) === progressScope.taskId);
    renderProgressTaskStudents(rows);
    return;
  }

  if (progressScope.subject) {
    const rows = getVisibleProgressRows().filter(row => getRowSubject(row) === progressScope.subject);
    renderProgressTaskButtons(rows);
    return;
  }

  renderProgressSubjectButtons(getVisibleProgressRows());
}

/* =========================================================
   INDIVIDUAL STUDENT VIEW
========================================================= */

function renderIndividualStudentTaskList(rows) {
  const container = byId("progressContent");
  if (!container) return;

  const visibleRows = rows.map(applyPendingToRow);

  if (!visibleRows.length) {
    container.innerHTML = `
      <div class="progress-header-row">
        <button class="secondary-button" onclick="showProgressHome()">Back</button>
        <h3>Student Progress</h3>
      </div>
      <p>No tasks found.</p>
    `;
    return;
  }

  const grouped = {};

  visibleRows.forEach(row => {
    const subject = getRowSubject(row);
    if (!grouped[subject]) grouped[subject] = [];
    grouped[subject].push(row);
  });

  container.innerHTML = `
    <div class="progress-header-row">
      <button class="secondary-button" onclick="showProgressHome()">Back</button>
      <h3>${escapeHtml(getRowStudentName(visibleRows[0]))}</h3>
    </div>

    ${Object.entries(grouped).map(([subject, subjectRows]) => `
      <section class="progress-group-block">
        <h4>${escapeHtml(subject)}</h4>

        <div class="progress-student-list">
          ${subjectRows.map(row => {
            const complete = isComplete(row);
            const verified = isVerified(row);
            const key = progressKey(row);

            return `
              <div class="progress-student-row individual-task-row">
                <div class="progress-student-name">${escapeHtml(getRowTaskTitle(row))}</div>

                <button
                  class="status-toggle ${complete ? "is-complete" : "is-off"}"
                  onclick="toggleProgressStatus('${escapeJs(key)}', 'completed')"
                >
                  ${complete ? "✓ Complete" : "Incomplete"}
                </button>

                <button
                  class="status-toggle ${verified ? "is-verified" : "is-off"}"
                  onclick="toggleProgressStatus('${escapeJs(key)}', 'verified')"
                >
                  ${verified ? "✓ Verified" : "Unverified"}
                </button>
              </div>
            `;
          }).join("")}
        </div>
      </section>
    `).join("")}

    <button class="primary-button save-progress-button" onclick="saveProgressPendingChanges()">
      Save Changes
    </button>
  `;
}

/* =========================================================
   SAVE PROGRESS CHANGES
========================================================= */

async function saveProgressPendingChanges() {
  if (!progressPendingUpdates.size) {
    showMessage("No changes to save.", "info");
    return;
  }

  const updates = Array.from(progressPendingUpdates.values());

  try {
    for (const update of updates) {
      if (typeof update.completed === "boolean") {
        await apiPost("/api/tasks/update-complete", {
          token: token(),
          studentId: update.studentId,
          taskId: update.taskId,
          completed: update.completed,
          complete: update.completed
        });
      }

      if (typeof update.verified === "boolean") {
        await apiPost("/api/admin/tasks/verify", {
          token: token(),
          studentId: update.studentId,
          taskId: update.taskId,
          verified: update.verified
        });
      }
    }

    progressPendingUpdates.clear();
    showMessage("Changes saved.", "success");

    await reloadCurrentProgressView();
  } catch (err) {
    console.error(err);
    showMessage(err.message || "Could not save changes. Please try again.", "error");
  }
}

async function reloadCurrentProgressView() {
  const previousSubject = progressScope.subject;
  const previousTaskId = progressScope.taskId;

  if (progressScope.mode === "student" && progressScope.studentId) {
    await loadProgressStudent(progressScope.studentId);
    return;
  }

  if (progressScope.mode === "group" && progressScope.group) {
    const group = progressScope.group;
    await loadProgressGroup(group);
  } else {
    await loadProgressClass();
  }

  if (previousSubject) {
    openProgressSubject(previousSubject);
  }

  if (previousTaskId) {
    openProgressTask(previousTaskId);
  }
}

/* =========================================================
   OPTIONAL TASK ADMIN FUNCTIONS
   These are included so the file is safe if buttons already call them.
========================================================= */

async function adminVerifyTask(studentId, taskId, verified) {
  try {
    await apiPost("/api/admin/tasks/verify", {
      token: token(),
      studentId,
      taskId,
      verified
    });

    showMessage("Verification updated.", "success");
  } catch (err) {
    showMessage(err.message || "Could not update verification.", "error");
  }
}

/* =========================================================
   GLOBAL EXPORTS FOR INLINE ONCLICK HANDLERS
========================================================= */

window.logout = logout;

window.studentLogin = studentLogin;
window.studentToggleComplete = studentToggleComplete;

window.adminLogin = adminLogin;
window.showAdminHome = showAdminHome;
window.showSubjectsScreen = showSubjectsScreen;
window.showAcademicsScreen = showAcademicsScreen;
window.showAttendanceScreen = showAttendanceScreen;

window.createSubject = createSubject;
window.updateSubject = updateSubject;

window.showProgressHome = showProgressHome;
window.loadProgressClass = loadProgressClass;
window.loadProgressGroup = loadProgressGroup;
window.loadProgressStudent = loadProgressStudent;
window.loadSelectedProgressGroup = loadSelectedProgressGroup;
window.loadSelectedProgressStudent = loadSelectedProgressStudent;

window.renderProgressSubjectButtons = renderProgressSubjectButtons;
window.getVisibleProgressRows = getVisibleProgressRows;
window.openProgressSubject = openProgressSubject;
window.openProgressTask = openProgressTask;
window.toggleProgressStatus = toggleProgressStatus;
window.saveProgressPendingChanges = saveProgressPendingChanges;
window.adminVerifyTask = adminVerifyTask;
