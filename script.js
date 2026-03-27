// ===== Grade mapping (example 10-point scale) =====
const GRADE_POINTS = {
  O: 10,
  "A+": 9,
  A: 8,
  "B+": 7,
  B: 6,
  C: 5,
  F: 0
};

// ===== State =====
const semesters = []; // {id, name, credits, sgpa, hasFailGrade}
let gradeStats = {}; // {grade: count}

// ===== DOM refs =====
const body = document.documentElement;
const themeToggle = document.getElementById("theme-toggle");

const semBody = document.getElementById("semester-body");
const addSemRowBtn = document.getElementById("add-sem-row");

const sgpaSemSelect = document.getElementById("sgpa-sem-select");
const sgpaSubjectsEl = document.getElementById("sgpa-subjects");
const addSubjectBtn = document.getElementById("add-subject");
const calcSgpaBtn = document.getElementById("calc-sgpa");
const sgpaOutputEl = document.getElementById("sgpa-output");

const summaryCgpaEl = document.getElementById("summary-cgpa");
const summaryPercentEl = document.getElementById("summary-percentage");
const summaryRatingEl = document.getElementById("summary-rating");
const summaryConsistencyEl = document.getElementById("summary-consistency");
const summaryImprovementEl = document.getElementById("summary-improvement");
const summaryNextSgpaEl = document.getElementById("summary-next-sgpa");

const sgpaLine = document.getElementById("sgpa-line");
const sgpaLineAxis = document.getElementById("sgpa-line-axis");

const sgpaBarChart = document.getElementById("sgpa-bar-chart");
const sgpaBarAxis = document.getElementById("sgpa-bar-axis");

const gradeDistEl = document.getElementById("grade-dist");

// ===== Theme handling =====
const THEME_KEY = "acad_report_theme";
const savedTheme = localStorage.getItem(THEME_KEY);
if (savedTheme) body.setAttribute("data-theme", savedTheme);

themeToggle.addEventListener("click", () => {
  const current = body.getAttribute("data-theme") || "light";
  const next = current === "light" ? "dark" : "light";
  body.setAttribute("data-theme", next);
  localStorage.setItem(THEME_KEY, next);
});

// ===== Utilities =====
function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

function getOverallCgpa() {
  // CGPA = Σ(SGPA_i × Credits_i) / Σ(Credits_i)
  let num = 0;
  let den = 0;
  semesters.forEach(s => {
    if (!isNaN(s.sgpa) && !isNaN(s.credits)) {
      num += s.sgpa * s.credits;
      den += s.credits;
    }
  });
  if (!den) return 0;
  return num / den;
}

function getConsistencyIndex() {
  const vals = semesters.map(s => s.sgpa).filter(v => !isNaN(v));
  const n = vals.length;
  if (n < 2) return null;
  const mean = vals.reduce((a, b) => a + b, 0) / n;
  const variance = vals.reduce((acc, v) => acc + (v - mean) ** 2, 0) / n;
  return Math.sqrt(variance);
}

function getImprovement() {
  const vals = semesters.map(s => s.sgpa).filter(v => !isNaN(v));
  if (vals.length < 2) return 0;
  return vals[vals.length - 1] - vals[0];
}

function getRatingFromCgpaAdvanced(cgpa) {
  const improvement = getImprovement();
  if (cgpa >= 8.5 && improvement >= 0.3) return "Excellent";
  if (cgpa >= 7.5) return "Very Good";
  if (cgpa >= 6.5) return "Good";
  if (cgpa >= 5) return "Average";
  if (cgpa > 0) return "Needs Improvement";
  return "N/A";
}

function predictNextSgpa() {
  const ys = semesters.map(s => s.sgpa).filter(v => !isNaN(v));
  const n = ys.length;
  if (n < 2) return null;

  const xs = ys.map((_, i) => i + 1);
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((acc, x, i) => acc + x * ys[i], 0);
  const sumX2 = xs.reduce((acc, x) => acc + x * x, 0);

  const denom = n * sumX2 - sumX * sumX;
  if (!denom) return null;

  const m = (n * sumXY - sumX * sumY) / denom;
  const c = (sumY - m * sumX) / n;
  const nextX = n + 1;
  return m * nextX + c;
}

// ===== Semester table =====
function addSemesterRow(initial) {
  const id = generateId();
  const index = semesters.length + 1;
  const data = {
    id,
    name: initial?.name || `Semester ${index}`,
    credits: initial?.credits || 0,
    sgpa: initial?.sgpa || 0,
    hasFailGrade: false
  };
  semesters.push(data);

  const tr = document.createElement("tr");
  tr.dataset.id = id;

  // Semester name
  const tdSem = document.createElement("td");
  const semInput = document.createElement("input");
  semInput.value = data.name;
  semInput.addEventListener("input", () => {
    data.name = semInput.value;
    syncSemesterSelect();
  });
  tdSem.appendChild(semInput);

  // Credits
  const tdCredits = document.createElement("td");
  const credInput = document.createElement("input");
  credInput.type = "number";
  credInput.min = "0";
  credInput.value = data.credits || "";
  credInput.addEventListener("input", () => {
    data.credits = parseFloat(credInput.value) || 0;
    recalcCgpaAndTable();
  });
  tdCredits.appendChild(credInput);

  // SGPA
  const tdSgpa = document.createElement("td");
  const sgpaInput = document.createElement("input");
  sgpaInput.type = "number";
  sgpaInput.step = "0.01";
  sgpaInput.min = "0";
  sgpaInput.max = "10";
  sgpaInput.value = data.sgpa || "";
  sgpaInput.addEventListener("input", () => {
    data.sgpa = parseFloat(sgpaInput.value) || 0;
    data.hasFailGrade = false; // manual SGPA entry resets F flag
    recalcCgpaAndTable();
  });
  tdSgpa.appendChild(sgpaInput);

  const tdCgpa = document.createElement("td");
  const tdPercent = document.createElement("td");
  const tdResult = document.createElement("td");

  tr.appendChild(tdSem);
  tr.appendChild(tdCredits);
  tr.appendChild(tdSgpa);
  tr.appendChild(tdCgpa);
  tr.appendChild(tdPercent);
  tr.appendChild(tdResult);

  semBody.appendChild(tr);

  syncSemesterSelect();
  recalcCgpaAndTable();
}

function recalcCgpaAndTable() {
  const overallCgpa = getOverallCgpa();
  const overallPercent = overallCgpa * 9.5;

  summaryCgpaEl.textContent = overallCgpa.toFixed(2);
  summaryPercentEl.textContent = `${overallPercent.toFixed(2)}%`;
  summaryRatingEl.textContent = getRatingFromCgpaAdvanced(overallCgpa);

  const consistency = getConsistencyIndex();
  summaryConsistencyEl.textContent =
    consistency == null ? "N/A" : consistency.toFixed(2);
  summaryImprovementEl.textContent = getImprovement().toFixed(2);

  const next = predictNextSgpa();
  summaryNextSgpaEl.textContent =
    next == null ? "N/A" : Math.max(0, Math.min(10, next)).toFixed(2);

  // row-wise calculations
  let lastIdxWithData = -1;
  Array.from(semBody.rows).forEach((row, idx) => {
    const id = row.dataset.id;
    const semData = semesters.find(s => s.id === id);
    const cgpaCell = row.cells[3];
    const percentCell = row.cells[4];
    const resultCell = row.cells[5];

    let num = 0;
    let den = 0;
    semesters.slice(0, idx + 1).forEach(s => {
      if (!isNaN(s.sgpa) && !isNaN(s.credits)) {
        num += s.sgpa * s.credits;
        den += s.credits;
      }
    });
    const cgpa = den ? num / den : 0;
    cgpaCell.textContent = cgpa ? cgpa.toFixed(2) : "-";

    const percent = cgpa * 9.5;
    percentCell.textContent = cgpa ? `${percent.toFixed(2)}%` : "-";

    const sgpaVal = semData.sgpa || 0;
    const isFail = sgpaVal < 5 || semData.hasFailGrade;
    resultCell.textContent = isFail ? "Fail" : "Pass";
    resultCell.className = isFail ? "result-fail" : "result-pass";

    const sgpaInput = row.cells[2].querySelector("input");
    sgpaInput.classList.remove("sgpa-low", "sgpa-mid", "sgpa-high");
    if (sgpaVal < 6) sgpaInput.classList.add("sgpa-low");
    else if (sgpaVal >= 6 && sgpaVal <= 8) sgpaInput.classList.add("sgpa-mid");
    else if (sgpaVal > 8) sgpaInput.classList.add("sgpa-high");

    if (sgpaVal && semData.credits) lastIdxWithData = idx;
  });

  // highlight current semester (last with data)
  Array.from(semBody.rows).forEach((row, idx) => {
    row.classList.toggle("current-sem", idx === lastIdxWithData);
  });

  renderCharts();
  renderGradeDistribution();
}

// ===== SGPA calculator section =====
function syncSemesterSelect() {
  sgpaSemSelect.innerHTML = "";
  semesters.forEach((s, i) => {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.name || `Semester ${i + 1}`;
    sgpaSemSelect.appendChild(opt);
  });
}

function addSubjectRow() {
  const row = document.createElement("div");
  row.className = "subject-row";

  const subInput = document.createElement("input");
  subInput.placeholder = "Subject name";

  const credInput = document.createElement("input");
  credInput.type = "number";
  credInput.min = "0";
  credInput.placeholder = "Cr";

  const gradeSelect = document.createElement("select");
  Object.keys(GRADE_POINTS).forEach(g => {
    const opt = document.createElement("option");
    opt.value = g;
    opt.textContent = g;
    gradeSelect.appendChild(opt);
  });

  row.appendChild(subInput);
  row.appendChild(credInput);
  row.appendChild(gradeSelect);
  sgpaSubjectsEl.appendChild(row);
}

function calculateSgpaFromSubjects() {
  const semId = sgpaSemSelect.value;
  if (!semId) {
    alert("Please select a semester.");
    return;
  }

  const rows = Array.from(sgpaSubjectsEl.getElementsByClassName("subject-row"));
  if (!rows.length) {
    alert("Add at least one subject.");
    return;
  }

  let sumCredit = 0;
  let sumCreditPoint = 0;
  let hasFail = false;

  gradeStats = {}; // recalc from scratch
  rows.forEach(r => {
    const [nameEl, credEl, gradeEl] = r.children;
    const credit = parseFloat(credEl.value) || 0;
    const grade = gradeEl.value;
    const gp = GRADE_POINTS[grade] ?? 0;

    sumCredit += credit;
    sumCreditPoint += credit * gp;
    gradeStats[grade] = (gradeStats[grade] || 0) + 1;
    if (grade === "F") hasFail = true;
  });

  if (!sumCredit) {
    alert("Total credits cannot be zero.");
    return;
  }

  const sgpa = sumCreditPoint / sumCredit;

  const semData = semesters.find(s => s.id === semId);
  if (!semData) return;

  semData.sgpa = sgpa;
  semData.credits = sumCredit;
  semData.hasFailGrade = hasFail;

  Array.from(semBody.rows).forEach(row => {
    if (row.dataset.id === semId) {
      row.cells[1].querySelector("input").value = sumCredit;
      row.cells[2].querySelector("input").value = sgpa.toFixed(2);
    }
  });

  sgpaOutputEl.textContent =
    `Calculated SGPA for ${semData.name}: ${sgpa.toFixed(2)} (Total Credits: ${sumCredit})` +
    (hasFail ? " – includes F grade (Result: Fail if SGPA < 5 or any F)." : "");

  recalcCgpaAndTable();
}

// ===== Charts =====
function renderCharts() {
  const sgpas = semesters.map(s => s.sgpa || 0);
  const n = sgpas.length;
  const maxSgpa = 10;

  // Line chart
  if (!n) {
    sgpaLine.setAttribute("points", "");
    sgpaLineAxis.innerHTML = "";
  } else {
    const minX = 5, maxX = 95, minY = 5, maxY = 35;
    const stepX = n > 1 ? (maxX - minX) / (n - 1) : 0;
    const points = sgpas.map((s, i) => {
      const x = n === 1 ? 50 : minX + stepX * i;
      const y = maxY - (s / maxSgpa) * (maxY - minY);
      return `${x},${y}`;
    }).join(" ");
    sgpaLine.setAttribute("points", points);

    sgpaLineAxis.innerHTML = "";
    semesters.forEach((s, i) => {
      const span = document.createElement("span");
      span.textContent = `S${i + 1}`;
      sgpaLineAxis.appendChild(span);
    });
  }

  // Bar chart
  sgpaBarChart.innerHTML = "";
  sgpaBarAxis.innerHTML = "";
  if (!n) return;

  const barWidth = 100 / (n * 1.4);
  const styles = getComputedStyle(document.documentElement);
  const colorLow = styles.getPropertyValue("--danger").trim();
  const colorMid = styles.getPropertyValue("--orange").trim();
  const colorHigh = styles.getPropertyValue("--success").trim();

  sgpas.forEach((val, i) => {
    const heightPct = (val / maxSgpa) * 35;
    const x = 5 + i * (barWidth * 1.4);

    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", x.toString());
    rect.setAttribute("width", barWidth.toString());
    rect.setAttribute("y", (40 - heightPct - 3).toString());
    rect.setAttribute("height", heightPct.toString());

    if (val < 6) rect.setAttribute("fill", colorLow);
    else if (val >= 6 && val <= 8) rect.setAttribute("fill", colorMid);
    else rect.setAttribute("fill", colorHigh);

    sgpaBarChart.appendChild(rect);

    const span = document.createElement("span");
    span.textContent = `S${i + 1}`;
    sgpaBarAxis.appendChild(span);
  });
}

// ===== Grade distribution =====
function renderGradeDistribution() {
  gradeDistEl.innerHTML = "";
  const total = Object.values(gradeStats).reduce((a, b) => a + b, 0);
  if (!total) {
    gradeDistEl.textContent = "Enter subjects and grades in SGPA Calculator to view distribution.";
    return;
  }

  Object.keys(GRADE_POINTS).forEach(grade => {
    const count = gradeStats[grade] || 0;
    if (!count) return;
    const pct = (count / total) * 100;

    const row = document.createElement("div");
    row.className = "grade-row";

    const label = document.createElement("span");
    label.className = "grade-label";
    label.textContent = grade;

    const countSpan = document.createElement("span");
    countSpan.className = "grade-count";
    countSpan.textContent = count;

    const track = document.createElement("div");
    track.className = "grade-bar-track";

    const fill = document.createElement("div");
    fill.className = "grade-bar-fill";
    fill.style.width = `${pct}%`;

    track.appendChild(fill);
    row.appendChild(label);
    row.appendChild(countSpan);
    row.appendChild(track);
    gradeDistEl.appendChild(row);
  });
}

// ===== Events =====
addSemRowBtn.addEventListener("click", () => addSemesterRow());
addSubjectBtn.addEventListener("click", addSubjectRow);
calcSgpaBtn.addEventListener("click", calculateSgpaFromSubjects);

// Keyboard UX: Enter in credits/SGPA triggers recalculation
semBody.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    e.preventDefault();
    recalcCgpaAndTable();
  }
});

// Prevent Ctrl+S default (optional)
document.addEventListener("keydown", e => {
  if (e.ctrlKey && e.key.toLowerCase() === "s") {
    e.preventDefault();
    // could show a toast "All changes are live in browser"
  }
});

// ===== Init 4-year (8 sem) skeleton =====
[
  "Semester 1",
  "Semester 2",
  "Semester 3",
  "Semester 4",
  "Semester 5",
  "Semester 6",
  "Semester 7",
  "Semester 8"
].forEach(name => addSemesterRow({ name }));

// Initial subject rows
for (let i = 0; i < 3; i++) addSubjectRow();
