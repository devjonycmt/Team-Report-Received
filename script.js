// Supabase Configuration
const SUPABASE_URL = "https://gyybjzmbxmymajnpcqwv.supabase.co";
const SUPABASE_KEY = "sb_publishable_olnbtN1yKc3i_F_EL6GNzw_JZZZKMkb";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// গ্লোবাল স্টেট অবজেক্ট
let state = {
  workReports: [],
  members: [],
};

let allSubmissions = [];
let allProfiles = {};
let currentSelectedCategory = "All";

// ডেট ইনপুটে তারিখ পরিবর্তন করলে সাথে সাথে ডাটা ও স্ট্যাটস আপডেট করার জন্য
const dateFilterEl = document.getElementById("report-date-filter");
if (dateFilterEl) {
  dateFilterEl.addEventListener("change", function () {
    filterReportsAndStats();
  });
}

window.onload = function () {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const todayStr = `${year}-${month}-${day}`;

  const dateInput = document.getElementById("report-date-filter");
  if (dateInput) {
    dateInput.value = todayStr;

    dateInput.addEventListener("change", function () {
      filterReportsAndStats();
    });
  }

  fetchAdminDashboardStats();
  fetchAdminReports();
  fetchUserAccountInfo();
  fetchPaymentInfo();
  fetchAdminWithdraws();

  // পেজ লোড হওয়ার সাথে সাথেই ড্যাশবোর্ড ট্যাব ডিফল্টভাবে দেখানোর জন্য এটি যুক্ত করুন:
  switchTab("dashboard");
};

function switchTab(tabName) {
  const tabs = ["dashboard", "reports", "users", "payments", "withdraws"];

  tabs.forEach((t) => {
    const tabEl = document.getElementById(`tab-${t}`);
    const btnEl = document.getElementById(`btn-${t}`);
    if (tabEl) tabEl.classList.add("hidden");
    if (btnEl) btnEl.classList.remove("bg-slate-800");
  });

  const activeTabTarget = document.getElementById(`tab-${tabName}`);
  const activeBtnTarget = document.getElementById(`btn-${tabName}`);

  if (activeTabTarget) activeTabTarget.classList.remove("hidden");
  if (activeBtnTarget) activeBtnTarget.classList.add("bg-slate-800");

  const titles = {
    dashboard: "Dashboard Overview",
    reports: "Reports Received",
    users: "User Reports",
    payments: "Payment Information",
    withdraws: "Withdraw Management",
  };

  const pageTitleEl = document.getElementById("page-title");
  if (pageTitleEl && titles[tabName]) {
    pageTitleEl.innerText = titles[tabName];
  }
}

// কাস্টম ডেট ফরম্যাট ফাংশন
function formatCustomDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const day = d.getDate();
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const month = months[d.getMonth()];
  const year = d.getFullYear();

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const seconds = String(d.getSeconds()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;

  return `${day} ${month} ${year}, ${hours}:${minutes}:${seconds} ${ampm}`;
}

// ১. ড্যাশবোর্ড স্ট্যাটস
async function fetchAdminDashboardStats() {
  const { data: submissions, error } = await _supabase
    .from("file_submissions")
    .select("*");
  if (error) return;

  const d = new Date();
  const currentMonth = d.getMonth();
  const currentYear = d.getFullYear();

  let monthTotal = 0,
    monthGood = 0,
    monthBad = 0,
    monthAmount = 0;

  submissions.forEach((sub) => {
    if (!sub.created_at) return;
    const subDate = new Date(sub.created_at);

    const totalAcc = Number(sub.account_count || 0);
    const goodAcc = Number(sub.good_count || 0);
    const badAcc = Number(sub.bad_count || 0);
    const amountAcc = Number(sub.total_amount || 0);

    if (
      subDate.getMonth() === currentMonth &&
      subDate.getFullYear() === currentYear
    ) {
      monthTotal += totalAcc;
      monthGood += goodAcc;
      monthBad += badAcc;
      monthAmount += amountAcc;
    }
  });

  document.getElementById("month-total").innerText = monthTotal;
  document.getElementById("month-good").innerText = monthGood;
  document.getElementById("month-bad").innerText = monthBad;
  document.getElementById("month-amount").innerText = monthAmount + " BDT";
}

// ২. রিপোর্ট ট্যাব এবং ক্যাটাগরি লোড
async function fetchAdminReports() {
  const { data: submissions, error } = await _supabase
    .from("file_submissions")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return;
  allSubmissions = submissions;

  const { data: profiles } = await _supabase
    .from("profiles")
    .select("id, full_name, username");
  if (profiles) {
    profiles.forEach((p) => {
      allProfiles[p.id] = p.full_name || p.username;
    });
  }

  renderCategoryTabs();
  filterReportsAndStats();
}

function renderCategoryTabs() {
  const container = document.getElementById("category-tabs-container");
  if (!container) return;

  const categories = [
    "All",
    ...new Set(allSubmissions.map((s) => s.category).filter(Boolean)),
  ];

  container.innerHTML = "";

  let tabsHtml = `<div class="flex flex-wrap gap-2 items-center justify-between w-full">`;

  let buttonsHtml = `<div class="flex flex-wrap gap-2">`;
  categories.forEach((cat) => {
    const isActive = currentSelectedCategory === cat;
    const btnClass = isActive
      ? "bg-indigo-600 text-white shadow-sm"
      : "bg-slate-100 text-slate-700 hover:bg-slate-200";

    buttonsHtml += `
            <button onclick="selectCategory('${cat}')" class="px-4 py-2 rounded-xl text-xs font-bold transition ${btnClass}">
                ${cat}
            </button>
        `;
  });
  buttonsHtml += `</div>`;

  let downloadBtnHtml = `
        <button onclick="downloadCurrentCategoryAllData()" class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm">
            <i class="fa-solid fa-download"></i> Download All (${currentSelectedCategory})
        </button>
    `;

  tabsHtml += buttonsHtml + downloadBtnHtml + `</div>`;
  container.innerHTML = tabsHtml;
}

function selectCategory(category) {
  currentSelectedCategory = category;
  renderCategoryTabs();
  filterReportsAndStats();
}

function getOrderedAccount(acc) {
  if (!acc || typeof acc !== "object") return acc;
  const newObj = {};
  const keys = Object.keys(acc);

  const uKey = keys.find(
    (k) => k.toLowerCase() === "username" || k.toLowerCase() === "user",
  );
  const pKey = keys.find(
    (k) => k.toLowerCase() === "password" || k.toLowerCase() === "pass",
  );
  const tKey = keys.find(
    (k) =>
      k.toLowerCase() === "2fa" ||
      k.toLowerCase() === "two_fa" ||
      k.toLowerCase() === "auth",
  );

  if (uKey) newObj[uKey] = acc[uKey];
  if (pKey) newObj[pKey] = acc[pKey];
  if (tKey) newObj[tKey] = acc[tKey];

  keys.forEach((k) => {
    if (k !== uKey && k !== pKey && k !== tKey) {
      newObj[k] = acc[k];
    }
  });

  return newObj;
}

function filterReportsAndStats() {
  const selectedDate = document.getElementById("report-date-filter").value;

  let filtered = allSubmissions.filter((sub) => {
    if (!sub.created_at) return false;
    const subDateStr = sub.created_at.split("T")[0];

    const matchesCategory =
      currentSelectedCategory === "All" ||
      sub.category === currentSelectedCategory;
    const matchesDate = selectedDate ? subDateStr === selectedDate : true;

    return matchesCategory && matchesDate;
  });

  let catSelectedTotal = 0,
    catSelectedGood = 0,
    catSelectedBad = 0,
    catSelectedAmount = 0;

  filtered.forEach((sub) => {
    catSelectedTotal += Number(sub.account_count || 0);
    catSelectedGood += Number(sub.good_count || 0);
    catSelectedBad += Number(sub.bad_count || 0);
    catSelectedAmount += Number(sub.total_amount || 0);
  });

  document.getElementById("cat-today-total").innerText = catSelectedTotal;
  document.getElementById("cat-today-good").innerText = catSelectedGood;
  document.getElementById("cat-today-bad").innerText = catSelectedBad;
  document.getElementById("cat-today-amount").innerText =
    catSelectedAmount + " BDT";

  renderReportsTable(filtered);
}

function resetDateFilter() {
  document.getElementById("report-date-filter").value = "";
  filterReportsAndStats();
}

function renderReportsTable(dataToRender) {
  const tbody = document.getElementById("admin-reports-table");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!dataToRender || dataToRender.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="py-4 text-center text-slate-400 text-xs">No reports found.</td></tr>`;
    return;
  }

  dataToRender.forEach((sub) => {
    const userName = allProfiles[sub.user_id] || "Unknown User";
    const formattedDate = formatCustomDate(sub.created_at);

    const status = String(sub.status || "pending").toLowerCase();
    let statusHtml = "";
    let actionHtml = "";

    // স্ট্যাটাস অনুযায়ী ব্যাজ এবং বাটন নির্ধারণ লজিক
    if (status === "pending" || status === "") {
      statusHtml = `<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-100">Pending</span>`;
      actionHtml = `<button onclick="updateSubmissionStatus('${sub.id}', 'Received')" class="bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold transition shadow-sm cursor-pointer">Mark Received</button>`;
    } else if (status === "received") {
      statusHtml = `
        <div class="flex items-center gap-2">
          <span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">Received</span>
          <button onclick="updateSubmissionStatus('${sub.id}', 'Pending')" class="bg-rose-500 hover:bg-rose-600 text-white px-2 py-1 rounded-md text-[10px] font-bold transition cursor-pointer shadow-sm" title="Cancel Received status">Cancel</button>
        </div>
      `;
      actionHtml = `<span class="text-xs font-semibold text-emerald-600">Received</span>`;
    } else if (status === "success") {
      statusHtml = `<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">Success</span>`;
      actionHtml = `<span class="text-xs font-semibold text-emerald-600">Completed</span>`;
    } else if (status === "payment_ready") {
      statusHtml = `<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-50 text-purple-600 border border-purple-100">Payment Ready</span>`;
      actionHtml = `<span class="text-xs font-semibold text-purple-600">Payment Ready</span>`;
    }

    tbody.innerHTML += `
      <tr class="border-b border-slate-100 text-xs">
        <td class="py-3 px-4 text-slate-600">${formattedDate}</td>
        <td class="py-3 px-4 font-bold text-slate-800">${userName}</td>
        <td class="py-3 px-4 font-semibold text-indigo-600">${sub.category || "N/A"}</td>
        <td class="py-3 px-4 text-slate-700">${sub.file_name || "Report"}</td>
        <td class="py-3 px-4 font-bold">${sub.account_count || 0}</td>
        <td class="py-3 px-4 font-bold text-emerald-600">${sub.good_count || 0}</td>
        <td class="py-3 px-4 font-bold text-rose-500">${sub.bad_count || 0}</td>
        <td class="py-3 px-4">${statusHtml}</td>
        <td class="py-3 px-4">
          <div class="flex items-center gap-2">
            ${actionHtml}
            <button onclick='downloadCategoryExcel(${JSON.stringify(sub.accounts_data || [])}, "${sub.category || "Report"}")' class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-medium transition cursor-pointer">
              <i class="fa-solid fa-download mr-1"></i> Download
            </button>
          </div>
        </td>
      </tr>
    `;
  });
}

async function updateSubmissionStatus(subId, newStatus) {
  const { error } = await _supabase
    .from("file_submissions")
    .update({ status: newStatus })
    .eq("id", subId);

  if (error) {
    alert("Failed to update status: " + error.message);
  } else {
    const target = allSubmissions.find((s) => String(s.id) === String(subId));
    if (target) {
      target.status = newStatus;
    }
    filterReportsAndStats();
  }
}

function downloadCategoryExcel(accountsArray, categoryName) {
  if (!accountsArray || accountsArray.length === 0) {
    alert("No accounts data found in this report!");
    return;
  }

  const orderedAccounts = accountsArray.map((acc) => getOrderedAccount(acc));
  const worksheet = XLSX.utils.json_to_sheet(orderedAccounts);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  XLSX.writeFile(workbook, `${categoryName}_Report.xlsx`);
}

let allUserSubmissions = [];

async function fetchUserAccountInfo() {
  const { data: submissions, error } = await _supabase
    .from("file_submissions")
    .select("*")
    .in("status", ["Received", "payment_ready"])
    .order("created_at", { ascending: false });

  allUserSubmissions = submissions || [];
  window.allSubmissions = allUserSubmissions;

  const dateInput = document.getElementById("user-date-filter");
  if (dateInput) {
    if (!dateInput.value) {
      const d = new Date();
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      dateInput.value = `${year}-${month}-${day}`;
    }

    if (!dateInput.hasAttribute("data-listener")) {
      dateInput.setAttribute("data-listener", "true");
      dateInput.addEventListener("change", function () {
        filterUserReports();
      });
    }
  }

  filterUserReports();
}

function filterUserReports() {
  const selectedDate = document.getElementById("user-date-filter")
    ? document.getElementById("user-date-filter").value
    : "";

  let filteredSubmissions = allUserSubmissions.filter((sub) => {
    if (!sub.created_at) return false;
    const subDateStr = sub.created_at.split("T")[0];
    const matchesDate = selectedDate ? subDateStr === selectedDate : true;
    return matchesDate;
  });

  renderUserReportsTable(filteredSubmissions);
}

let currentEditSub = null;

// User Reports টেবিল রেন্ডার ফাংশন (Edit বাটন সহ)
async function renderUserReportsTable(submissions) {
  const { data: profiles } = await _supabase
    .from("profiles")
    .select("id, full_name, username");

  const profileMap = {};
  if (profiles) {
    profiles.forEach((p) => {
      profileMap[p.id] = p.full_name || p.username;
    });
  }

  const { data: payRequests } = await _supabase
    .from("payment_requests")
    .select("id, submission_id, status")
    .eq("status", "pending");

  const payReqMap = {};
  if (payRequests) {
    payRequests.forEach((req) => {
      if (req.submission_id) {
        payReqMap[req.submission_id] = req.id;
      }
    });
  }

  const tbody = document.getElementById("admin-user-reports-table");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!submissions || submissions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="py-4 text-center text-slate-400 text-xs">No reports found for this date.</td></tr>`;
    return;
  }

  submissions.forEach((sub) => {
    const userName = profileMap[sub.user_id] || "Unknown User";
    const formattedDate = formatCustomDate(sub.created_at);
    const totalAmount = Number(sub.total_amount || 0);

    const existingReqId = payReqMap[sub.id];
    let actionHtml = "";
    let statusBadge = "";

    // Edit বাটনটি সবসময় অ্যাকশন কলামে থাকবে
    const editBtn = `
      <button onclick="openEditModal('${sub.id}')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer shadow-sm flex items-center gap-1">
        <i class="fa-solid fa-pen-to-square"></i> Edit
      </button>
    `;

    if (sub.status === "payment_ready") {
      statusBadge = `<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-50 text-purple-600 border border-purple-100">Payment Ready</span>`;
      actionHtml = `
        <div class="flex items-center gap-1.5 flex-wrap">
          ${editBtn}
          <button onclick="cancelPaymentPending('${existingReqId || ""}', '${sub.id}')" class="bg-rose-500 hover:bg-rose-600 text-white px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer shadow-sm">
            Cancel Pending
          </button>
        </div>
      `;
    } else {
      statusBadge = `<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">Received</span>`;
      actionHtml = `
        <div class="flex items-center gap-1.5 flex-wrap">
          ${editBtn}
          <button onclick="sendPaymentToPending('${sub.id}')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer shadow-sm">
            Payment Pending
          </button>
        </div>
      `;
    }

    tbody.innerHTML += `
      <tr class="border-b border-slate-100 text-xs">
        <td class="py-3 px-4 text-slate-600">${formattedDate}</td>
        <td class="py-3 px-4 font-bold text-slate-800">${userName}</td>
        <td class="py-3 px-4 font-semibold text-indigo-600">${sub.category || "N/A"}</td>
        <td class="py-3 px-4 font-bold">${sub.account_count || 0}</td>
        <td class="py-3 px-4 font-bold text-emerald-600">${sub.good_count || 0}</td>
        <td class="py-3 px-4 font-bold text-rose-500">${sub.bad_count || 0}</td>
        <td class="py-3 px-4 font-bold text-indigo-600">${totalAmount} BDT</td>
        <td class="py-3 px-4">${statusBadge}</td>
        <td class="py-3 px-4">${actionHtml}</td>
      </tr>
    `;
  });
}

// মডাল ওপেন করার ফাংশন
function openEditModal(subId) {
  const sub = allUserSubmissions.find((s) => String(s.id) === String(subId));
  if (!sub) return;
  currentEditSub = sub;

  document.getElementById("edit-sub-id").value = sub.id;
  document.getElementById("edit-total-account").value = sub.account_count || 0;
  document.getElementById("edit-good-input").value = sub.good_count || 0;

  calculateEditValues();
  document.getElementById("edit-report-modal").classList.remove("hidden");
}

// মডাল ক্লোজ করার ফাংশন
function closeEditModal() {
  document.getElementById("edit-report-modal").classList.add("hidden");
  currentEditSub = null;
}

// লাইভ ক্যালকুলেশন এবং প্রাইসিং টায়ার লজিক
function calculateEditValues() {
  if (!currentEditSub) return;
  const totalAcc = Number(currentEditSub.account_count || 0);
  let goodAcc = parseInt(document.getElementById("edit-good-input").value) || 0;

  // ভ্যালিডেশন: Good count যেন Total account এর বেশি না হয়
  if (goodAcc > totalAcc) {
    goodAcc = totalAcc;
    document.getElementById("edit-good-input").value = goodAcc;
  }
  if (goodAcc < 0) {
    goodAcc = 0;
    document.getElementById("edit-good-input").value = 0;
  }

  // Bad count বের করা (Total - Good)
  const badAcc = totalAcc - goodAcc;
  document.getElementById("edit-bad-display").value = badAcc;

  // প্রাইসিং টায়ার নির্ধারণ
  let rate = 4.5;
  if (goodAcc >= 500) {
    rate = 5.0;
  } else {
    rate = 4.5;
  }

  const totalAmount = goodAcc * rate;

  document.getElementById("edit-rate-display").innerText =
    rate.toFixed(2) + " BDT";
  document.getElementById("edit-total-amount-display").innerText =
    totalAmount.toFixed(2) + " BDT";
}

// এডিট করা ডাটা Supabase-এ সেভ করার ফাংশন
async function saveUserReportEdit() {
  if (!currentEditSub) return;
  const totalAcc = Number(currentEditSub.account_count || 0);
  const goodAcc =
    parseInt(document.getElementById("edit-good-input").value) || 0;
  const badAcc = totalAcc - goodAcc;

  let rate = 5.0;
  if (goodAcc >= 500) {
    rate = 5.3;
  } else if (goodAcc >= 100) {
    rate = 5.1;
  } else {
    rate = 5.0;
  }
  const totalAmount = goodAcc * rate;

  // file_submissions টেবিলে আপডেট করা
  const { error } = await _supabase
    .from("file_submissions")
    .update({
      good_count: goodAcc,
      bad_count: badAcc,
      total_amount: totalAmount,
    })
    .eq("id", currentEditSub.id);

  if (error) {
    alert("Failed to update: " + error.message);
    return;
  }

  // যদি payment_requests টেবিলে এন্ট্রি থাকে তবে সেখানেও আপডেট করা
  await _supabase
    .from("payment_requests")
    .update({
      good_count: goodAcc,
      bad_count: badAcc,
      total_amount: totalAmount,
    })
    .eq("submission_id", currentEditSub.id);

  closeEditModal();
  fetchUserAccountInfo();
  fetchAdminReports();
  if (typeof fetchPaymentInfo === "function") fetchPaymentInfo();
}

async function sendPaymentToPending(subId) {
  const sub = allSubmissions.find((s) => String(s.id) === String(subId));
  if (!sub) {
    alert("Submission data not found!");
    return;
  }

  const { error: insertError } = await _supabase
    .from("payment_requests")
    .insert([
      {
        submission_id: sub.id,
        user_id: sub.user_id,
        category: sub.category,
        file_name: sub.file_name,
        account_count: sub.account_count || 0,
        good_count: sub.good_count || 0,
        bad_count: sub.bad_count || 0,
        total_amount: sub.total_amount || 0,
        status: "payment_ready",
      },
    ]);

  if (insertError) {
    alert("Error: " + insertError.message);
    return;
  }

  const { error: updateError } = await _supabase
    .from("file_submissions")
    .update({ status: "payment_ready" })
    .eq("id", subId);

  if (updateError) {
    alert("Error updating status: " + updateError.message);
  } else {
    fetchUserAccountInfo();
    if (typeof fetchPaymentInfo === "function") fetchPaymentInfo();
  }
}

async function cancelPaymentPending(requestId, subId) {
  if (requestId) {
    await _supabase.from("payment_requests").delete().eq("id", requestId);
  } else {
    await _supabase
      .from("payment_requests")
      .delete()
      .eq("submission_id", subId);
  }

  const { error: updateError } = await _supabase
    .from("file_submissions")
    .update({ status: "Received" })
    .eq("id", subId);

  if (updateError) {
    alert("Failed to cancel: " + updateError.message);
  } else {
    fetchUserAccountInfo();
    if (typeof fetchPaymentInfo === "function") fetchPaymentInfo();
  }
}

let allPaymentRequests = [];

async function fetchPaymentInfo() {
  const { data: requests, error } = await _supabase
    .from("payment_requests")
    .select("*")
    .in("status", ["payment_ready", "success"])
    .order("created_at", { ascending: false });

  allPaymentRequests = requests || [];

  const dateInput = document.getElementById("payment-date-filter");
  if (dateInput) {
    if (!dateInput.value) {
      const d = new Date();
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      dateInput.value = `${year}-${month}-${day}`;
    }

    if (!dateInput.hasAttribute("data-listener")) {
      dateInput.setAttribute("data-listener", "true");
      dateInput.addEventListener("change", function () {
        filterPaymentReports();
      });
    }
  }

  filterPaymentReports();
}

async function filterPaymentReports() {
  const selectedDate = document.getElementById("payment-date-filter")
    ? document.getElementById("payment-date-filter").value
    : "";

  let filteredRequests = allPaymentRequests.filter((item) => {
    if (!item.created_at) return false;
    const itemDateStr = item.created_at.split("T")[0];
    const matchesDate = selectedDate ? itemDateStr === selectedDate : true;
    return matchesDate;
  });

  const { data: profiles } = await _supabase
    .from("profiles")
    .select("id, full_name, username");

  const profileMap = {};
  if (profiles) {
    profiles.forEach((p) => {
      profileMap[p.id] = p.full_name || p.username;
    });
  }

  const tbody = document.getElementById("admin-payments-table");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!filteredRequests || filteredRequests.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="py-4 text-center text-slate-400 text-xs">No payment requests found for this date.</td></tr>`;
    document.getElementById("stat-total-ready").innerText = "0 BDT";
    document.getElementById("stat-total-success").innerText = "0 BDT";
    document.getElementById("stat-success-count").innerText = "0";
    return;
  }

  let totalReadyAmount = 0;
  let totalSuccessAmount = 0;
  let successCount = 0;

  filteredRequests.forEach((item) => {
    const itemAmount = Number(item.total_amount) || 0;
    if (item.status === "payment_ready") {
      totalReadyAmount += itemAmount;
    } else if (item.status === "success") {
      totalSuccessAmount += itemAmount;
      successCount++;
    }
  });

  document.getElementById("stat-total-ready").innerText =
    totalReadyAmount + " BDT";
  document.getElementById("stat-total-success").innerText =
    totalSuccessAmount + " BDT";
  document.getElementById("stat-success-count").innerText = successCount;

  filteredRequests.forEach((item) => {
    const userName = profileMap[item.user_id] || "Unknown User";
    const formattedDate = item.created_at
      ? formatCustomDate(item.created_at)
      : "N/A";
    const itemAmount = Number(item.total_amount) || 0;

    let statusBadge = "";
    let actionHtml = "";

    if (item.status === "success") {
      statusBadge = `<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">Success</span>`;
      actionHtml = `
        <button onclick="cancelPaymentSuccess('${item.id}', '${item.submission_id}')" class="bg-rose-500 hover:bg-rose-600 text-white px-3 py-1.5 rounded-lg font-medium transition cursor-pointer shadow-sm">
          Cancel Payment
        </button>
      `;
    } else {
      statusBadge = `<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-50 text-purple-600 border border-purple-100">Payment Ready</span>`;
      actionHtml = `
        <button onclick="confirmPaymentSuccess('${item.id}', '${item.submission_id}')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-medium transition cursor-pointer shadow-sm">
          Pay Confirm
        </button>
      `;
    }

    tbody.innerHTML += `
      <tr class="border-b border-slate-100 text-xs">
        <td class="py-3 px-4 font-bold text-slate-800">${userName}</td>
        <td class="py-3 px-4 text-slate-600">${formattedDate}</td>
        <td class="py-3 px-4 font-bold text-emerald-600">${item.good_count || 0}</td>
        <td class="py-3 px-4 font-bold text-purple-600">${itemAmount} BDT</td>
        <td class="py-3 px-4">${statusBadge}</td>
        <td class="py-3 px-4">${actionHtml}</td>
      </tr>
    `;
  });
}

async function confirmPaymentSuccess(requestId, subId) {
  const { error: err1 } = await _supabase
    .from("payment_requests")
    .update({ status: "success" })
    .eq("id", requestId);

  if (err1) {
    alert("Failed to confirm payment: " + err1.message);
    return;
  }

  if (subId && subId !== "undefined") {
    await _supabase
      .from("file_submissions")
      .update({ status: "success" })
      .eq("id", subId);
  }

  fetchPaymentInfo();
}

async function cancelPaymentSuccess(requestId, subId) {
  const { error: err1 } = await _supabase
    .from("payment_requests")
    .update({ status: "payment_ready" })
    .eq("id", requestId);

  if (err1) {
    alert("Failed to cancel payment: " + err1.message);
    return;
  }

  if (subId && subId !== "undefined") {
    await _supabase
      .from("file_submissions")
      .update({ status: "payment_ready" })
      .eq("id", subId);
  }

  fetchPaymentInfo();
}

function downloadCurrentCategoryAllData() {
  const selectedDate = document.getElementById("report-date-filter").value;
  let combinedAccounts = [];
  let totalCount = 0;

  allSubmissions.forEach((sub) => {
    if (!sub.created_at) return;
    const subDateStr = sub.created_at.split("T")[0];

    const matchesCategory =
      currentSelectedCategory === "All" ||
      sub.category === currentSelectedCategory;
    const matchesDate = selectedDate ? subDateStr === selectedDate : true;

    if (
      matchesCategory &&
      matchesDate &&
      sub.accounts_data &&
      Array.isArray(sub.accounts_data)
    ) {
      totalCount += sub.accounts_data.length;
      sub.accounts_data.forEach((acc) => {
        combinedAccounts.push(getOrderedAccount(acc));
      });
    }
  });

  if (combinedAccounts.length === 0) {
    alert("No data available to download for this selection!");
    return;
  }

  let datePart = "";
  if (selectedDate) {
    const parts = selectedDate.split("-");
    datePart = `${parts[2]}-${parts[1]}-${parts[0]}`;
  } else {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    datePart = `${day}-${month}-${year}`;
  }

  const categoryName =
    currentSelectedCategory === "All" ? "All_Reports" : currentSelectedCategory;

  const fileName = `${datePart}_${categoryName}_${totalCount}-pis.xlsx`;

  const worksheet = XLSX.utils.json_to_sheet(combinedAccounts);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  XLSX.writeFile(workbook, fileName);
}

let allWithdrawRequests = [];
async function fetchAdminWithdraws() {
  // ১. উইথড্র রিকোয়েস্ট ফেচ করা
  const { data: withdraws, error } = await _supabase
    .from("withdraws")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching withdraws:", error);
  }
  allWithdrawRequests = withdraws || [];

  // ২. payment_requests টেবিল থেকে পেমেন্ট রিকোয়েস্ট ফেচ করা
  const { data: payRequests, error: payError } = await _supabase
    .from("payment_requests")
    .select("*");

  if (payError) {
    console.error("Error fetching payment_requests:", payError);
    allPaymentRequests = [];
  } else {
    allPaymentRequests = payRequests || [];
  }

  const dateInput = document.getElementById("withdraw-date-filter");
  if (dateInput) {
    if (!dateInput.value) {
      const d = new Date();
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      dateInput.value = `${year}-${month}-${day}`;
    }

    if (!dateInput.hasAttribute("data-listener")) {
      dateInput.setAttribute("data-listener", "true");
      dateInput.addEventListener("change", function () {
        renderAdminWithdrawsTable();
      });
    }
  }

  renderAdminWithdrawsTable();
}

async function renderAdminWithdrawsTable() {
  const selectedDate = document.getElementById("withdraw-date-filter")
    ? document.getElementById("withdraw-date-filter").value
    : "";

  // উইথড্র ফিল্টার তারিখ অনুযায়ী
  let filteredWithdraws = allWithdrawRequests.filter((item) => {
    if (!item.created_at) return false;
    const itemDateStr = item.created_at.split("T")[0];
    return selectedDate ? itemDateStr === selectedDate : true;
  });

  // payment_requests ফিল্টার (যেগুলোর স্ট্যাটাস success)
  let filteredPaymentRequests = allPaymentRequests.filter((item) => {
    const status = String(item.status || "").toLowerCase();
    const isSuccess =
      status === "success" || status === "completed" || status === "paid";
    if (!isSuccess) return false;

    if (!selectedDate) return true;
    if (!item.created_at) return false;
    return item.created_at.split("T")[0] === selectedDate;
  });

  // ইউজারদের নাম পাওয়ার জন্য প্রোফাইল ম্যাপ তৈরি
  const { data: profiles } = await _supabase
    .from("profiles")
    .select("id, full_name, username");

  const profileMap = {};
  if (profiles) {
    profiles.forEach((p) => {
      profileMap[p.id] = p.full_name || p.username;
    });
  }

  // কার্ডের জন্য মোট সফল পেমেন্ট অ্যামাউন্ট হিসাব
  let totalSuccessPaymentAmount = 0;
  filteredPaymentRequests.forEach((p) => {
    totalSuccessPaymentAmount += Number(p.total_amount || p.amount) || 0;
  });

  let totalPendingAmount = 0;
  let totalSuccessAmount = 0;

  allWithdrawRequests.forEach((item) => {
    const amt = Number(item.amount) || 0;
    if (item.status === "pending") {
      totalPendingAmount += amt;
    } else if (item.status === "success") {
      totalSuccessAmount += amt;
    }
  });

  // কার্ডগুলোতে ভ্যালু বসানো
  const paymentCardEl = document.getElementById("stat-withdraw-total-payment");
  if (paymentCardEl) {
    paymentCardEl.innerText = totalSuccessPaymentAmount + " BDT";
  }

  const pendingEl = document.getElementById("stat-total-withdraw-pending");
  if (pendingEl) pendingEl.innerText = totalPendingAmount + " BDT";

  const successEl = document.getElementById("stat-total-withdraw-success");
  if (successEl) successEl.innerText = totalSuccessAmount + " BDT";

  // --- ১. বাম পাশের টেবিল রেন্ডার: User Financial Summary (Earned, Withdraw, Balance) ---
  const leftTbody = document.getElementById(
    "admin-success-payments-summary-table",
  );
  if (leftTbody) {
    leftTbody.innerHTML = "";

    // প্রতিটি ইউজারের মোট সফল পেমেন্ট এবং গুড অ্যাকাউন্ট হিসাব করা
    const userSummaryMap = {};

    // সমস্ত সফল পেমেন্ট যোগ করা (তারিখের ফিল্টার ছাড়াই টোটাল হিসাব রাখার জন্য অথবা ফিল্টারসহ)
    allPaymentRequests.forEach((item) => {
      const status = String(item.status || "").toLowerCase();
      if (status !== "success" && status !== "completed" && status !== "paid")
        return;

      const uid = item.user_id || "unknown";
      if (!userSummaryMap[uid]) {
        userSummaryMap[uid] = { goodCount: 0, totalEarn: 0, totalWithdraw: 0 };
      }
      userSummaryMap[uid].goodCount += Number(item.good_count) || 0;
      userSummaryMap[uid].totalEarn +=
        Number(item.total_amount || item.amount) || 0;
    });

    // প্রতিটি ইউজারের মোট সফল উইথড্র অ্যামাউন্ট যোগ করা
    allWithdrawRequests.forEach((item) => {
      const status = String(item.status || "").toLowerCase();
      if (status !== "success") return; // শুধুমাত্র সফল উইথড্রগুলো ব্যালেন্স থেকে কাটবে

      const uid = item.user_id || "unknown";
      if (!userSummaryMap[uid]) {
        userSummaryMap[uid] = { goodCount: 0, totalEarn: 0, totalWithdraw: 0 };
      }
      userSummaryMap[uid].totalWithdraw += Number(item.amount) || 0;
    });

    const summaryKeys = Object.keys(userSummaryMap);
    if (summaryKeys.length === 0) {
      leftTbody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-slate-400 text-xs">No financial data found.</td></tr>`;
    } else {
      summaryKeys.forEach((uid) => {
        const userName = profileMap[uid] || "Unknown User";
        const summary = userSummaryMap[uid];
        const currentBalance = summary.totalEarn - summary.totalWithdraw; // কারেন্ট ব্যালেন্স হিসাব

        leftTbody.innerHTML += `
          <tr class="border-b border-slate-100 text-xs">
            <td class="py-3 px-2 font-bold text-slate-800">${userName}</td>
            <td class="py-3 px-2 text-center font-semibold text-emerald-600">${summary.goodCount}</td>
            <td class="py-3 px-2 text-right font-bold text-indigo-600">${summary.totalEarn} BDT</td>
            <td class="py-3 px-2 text-right font-bold text-rose-500">${summary.totalWithdraw} BDT</td>
            <td class="py-3 px-2 text-right font-black text-emerald-700">${currentBalance} BDT</td>
          </tr>
        `;
      });
    }
  }

  // --- ২. ডান পাশের টেবিল রেন্ডার: Withdraw Management Table ---
  const tbody = document.getElementById("admin-withdraws-table");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!filteredWithdraws || filteredWithdraws.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-slate-400 text-xs">No withdraw requests found.</td></tr>`;
    return;
  }

  filteredWithdraws.forEach((item) => {
    const userName = profileMap[item.user_id] || "Unknown User";
    const amount = Number(item.amount) || 0;
    const bkashNum = item.bkash_number || "N/A";

    let statusBadge = "";
    let actionHtml = "";

    if (item.status === "success") {
      statusBadge = `<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">Success</span>`;
      actionHtml = `
        <button onclick="updateWithdrawStatus('${item.id}', 'pending')" class="bg-rose-500 hover:bg-rose-600 text-white px-2.5 py-1 rounded-lg font-medium transition cursor-pointer shadow-sm text-[11px]">
          Cancel
        </button>
      `;
    } else {
      statusBadge = `<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-100">Pending</span>`;
      actionHtml = `
        <button onclick="updateWithdrawStatus('${item.id}', 'success')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded-lg font-medium transition cursor-pointer shadow-sm text-[11px]">
          Payment Now
        </button>
      `;
    }

    tbody.innerHTML += `
      <tr class="border-b border-slate-100 text-xs">
        <td class="py-3 px-3 font-bold text-slate-800">${userName}</td>
        <td class="py-3 px-3 font-semibold text-slate-700">${bkashNum}</td>
        <td class="py-3 px-3 font-bold text-indigo-600">${amount} BDT</td>
        <td class="py-3 px-3">${statusBadge}</td>
        <td class="py-3 px-3 text-right">${actionHtml}</td>
      </tr>
    `;
  });
}

// Payment Now বাটনে ক্লিক করলে স্ট্যাটাস success করার ফাংশন
async function updateWithdrawStatus(withdrawId, newStatus) {
  const { error } = await _supabase
    .from("withdraws")
    .update({ status: newStatus })
    .eq("id", withdrawId);

  if (error) {
    alert("Failed to update withdraw status: " + error.message);
    return;
  }

  // সফলভাবে আপডেট হলে লিস্ট রিফ্রেশ করবে
  fetchAdminWithdraws();
}
