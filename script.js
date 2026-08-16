// Supabase Configuration
const SUPABASE_URL = "https://gyybjzmbxmymajnpcqwv.supabase.co";
const SUPABASE_KEY = "sb_publishable_olnbtN1yKc3i_F_EL6GNzw_JZZZKMkb";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let allSubmissions = [];
let allProfiles = {};
let currentSelectedCategory = "All";
window.onload = function () {
  // ডিফল্টভাবে আজকের তারিখ ইনপুটে বসিয়ে দেওয়া
  const todayStr = new Date().toISOString().split("T")[0];
  const dateInput = document.getElementById("report-date-filter");
  if (dateInput) {
    dateInput.value = todayStr;
  }

  fetchAdminDashboardStats();
  fetchAdminReports();
  fetchUserAccountInfo();
  fetchPaymentInfo();
};

function switchTab(tabName) {
  const tabs = ["dashboard", "reports", "users", "payments"];
  tabs.forEach((t) => {
    const tabEl = document.getElementById(`tab-${t}`);
    const btnEl = document.getElementById(`btn-${t}`);
    if (tabEl) tabEl.classList.add("hidden");
    if (btnEl) btnEl.classList.remove("bg-slate-800");
  });

  const activeTab = document.getElementById(`tab-${tabName}`);
  const activeBtn = document.getElementById(`btn-${tabName}`);

  if (activeTab) activeTab.classList.remove("hidden");
  if (activeBtn) activeBtn.classList.add("bg-slate-800");

  const titles = {
    dashboard: "Dashboard Overview",
    reports: "Reports Received",
    users: "User Account Information",
    payments: "Payment Information",
  };
  document.getElementById("page-title").innerText = titles[tabName];
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

  const todayStr = new Date().toISOString().split("T")[0];
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  let todayTotal = 0,
    todayGood = 0,
    todayBad = 0,
    todayAmount = 0;
  let monthTotal = 0,
    monthGood = 0,
    monthBad = 0,
    monthAmount = 0;

  submissions.forEach((sub) => {
    if (!sub.created_at) return;
    const subDate = new Date(sub.created_at);
    const subDateStr = sub.created_at.split("T")[0];

    const totalAcc = Number(sub.account_count || 0);
    const goodAcc = Number(sub.good_count || 0);
    const badAcc = Number(sub.bad_count || 0);
    const amountAcc = Number(sub.total_amount || 0);

    if (subDateStr === todayStr) {
      todayTotal += totalAcc;
      todayGood += goodAcc;
      todayBad += badAcc;
      todayAmount += amountAcc;
    }

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

  document.getElementById("today-total").innerText = todayTotal;
  document.getElementById("today-good").innerText = todayGood;
  document.getElementById("today-bad").innerText = todayBad;
  document.getElementById("today-amount").innerText = todayAmount + " BDT";

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

// ক্যাটাগরি ট্যাব রেন্ডার করা এবং ডাউনলোড বাটন সংযুক্ত করা
function renderCategoryTabs() {
  const container = document.getElementById("category-tabs-container");
  if (!container) return;

  const categories = [
    "All",
    ...new Set(allSubmissions.map((s) => s.category).filter(Boolean)),
  ];

  container.innerHTML = "";

  // ক্যাটাগরি ট্যাবসমূহ এবং একটি ট্যাব-কন্টেন্ট ডাউনলোড বাটন একসাথে তৈরি
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

  // বর্তমান সিলেক্টেড ক্যাটাগরির সমস্ত ডাটা একসাথে ডাউনলোড করার বাটন
  let downloadBtnHtml = `
        <button onclick="downloadCurrentCategoryAllData()" class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm">
            <i class="fa-solid fa-download"></i> Download All (${currentSelectedCategory})
        </button>
    `;

  tabsHtml += buttonsHtml + downloadBtnHtml + `</div>`;
  container.innerHTML = tabsHtml;
}

// ক্যাটাগরি সিলেক্ট করার ফাংশন
function selectCategory(category) {
  currentSelectedCategory = category;
  renderCategoryTabs();
  filterReportsAndStats();
}
// কলামগুলোর সঠিক অর্ডার বজায় রাখার হেল্পার ফাংশন (Username -> Password -> 2FA -> Others)
function getOrderedAccount(acc) {
  if (!acc || typeof acc !== "object") return acc;
  const newObj = {};
  const keys = Object.keys(acc);

  // কলামগুলোর নাম শনাক্ত করা (বড়/ছোট হাতের অক্ষর মিলিয়ে)
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

  // প্রথমে Username, Password ও 2FA সেট করা হচ্ছে
  if (uKey) newObj[uKey] = acc[uKey];
  if (pKey) newObj[pKey] = acc[pKey];
  if (tKey) newObj[tKey] = acc[tKey];

  // এরপর বাকি কলামগুলো ক্রমানুসারে যুক্ত করা হচ্ছে
  keys.forEach((k) => {
    if (k !== uKey && k !== pKey && k !== tKey) {
      newObj[k] = acc[k];
    }
  });

  return newObj;
}
// মূল ফাইলের কলাম ও ডাটা যেভাবে আছে হুবহু সেভাবে ক্যাটাগরি অনুযায়ী ডাউনলোড করার ফাংশন
// ক্যাটাগরি অনুযায়ী সমস্ত ডাটা ডাউনলোডের ফাংশন
function downloadCurrentCategoryAllData() {
  let combinedAccounts = [];

  allSubmissions.forEach((sub) => {
    const matchesCategory =
      currentSelectedCategory === "All" ||
      sub.category === currentSelectedCategory;
    if (
      matchesCategory &&
      sub.accounts_data &&
      Array.isArray(sub.accounts_data)
    ) {
      sub.accounts_data.forEach((acc) => {
        combinedAccounts.push(getOrderedAccount(acc));
      });
    }
  });

  if (combinedAccounts.length === 0) {
    alert("No data available to download for this category!");
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(combinedAccounts);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  XLSX.writeFile(workbook, `${currentSelectedCategory}_All_Accounts.xlsx`);
}

// ডেট এবং ক্যাটাগরি ফিল্টার অনুযায়ী টেবিল এবং কার্ডের স্ট্যাটস আপডেট করার ফাংশন
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

  // ফিল্টারকৃত ডাটা (সিলেক্টেড ডেট ও ক্যাটাগরি) থেকে কার্ডের স্ট্যাটস হিসাব করা হচ্ছে
  allSubmissions.forEach((sub) => {
    if (!sub.created_at) return;
    const subDateStr = sub.created_at.split("T")[0];

    const matchesCategory =
      currentSelectedCategory === "All" ||
      sub.category === currentSelectedCategory;
    const matchesDate = selectedDate ? subDateStr === selectedDate : true;

    if (matchesCategory && matchesDate) {
      catSelectedTotal += Number(sub.account_count || 0);
      catSelectedGood += Number(sub.good_count || 0);
      catSelectedBad += Number(sub.bad_count || 0);
      catSelectedAmount += Number(sub.total_amount || 0);
    }
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

// টেবিল রেন্ডার করা
function renderReportsTable(dataToRender) {
  const tbody = document.getElementById("admin-reports-table");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!dataToRender || dataToRender.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="py-4 text-center text-slate-400 text-xs">No reports found.</td></tr>`;
    return;
  }

  dataToRender.forEach((sub) => {
    const userName = allProfiles[sub.user_id] || "Unknown User";
    const formattedDate = formatCustomDate(sub.created_at);

    tbody.innerHTML += `
            <tr class="border-b border-slate-100 text-xs">
                <td class="py-3 px-4 text-slate-600">${formattedDate}</td>
                <td class="py-3 px-4 font-bold text-slate-800">${userName}</td>
                <td class="py-3 px-4 font-semibold text-indigo-600">${sub.category || "N/A"}</td>
                <td class="py-3 px-4 text-slate-700">${sub.file_name || "Report"}</td>
                <td class="py-3 px-4 font-bold">${sub.account_count || 0}</td>
                <td class="py-3 px-4 font-bold text-emerald-600">${sub.good_count || 0}</td>
                <td class="py-3 px-4 font-bold text-rose-500">${sub.bad_count || 0}</td>
                <td class="py-3 px-4">
                    <button onclick='downloadCategoryExcel(${JSON.stringify(sub.accounts_data || [])}, "${sub.category || "Report"}")' class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-medium transition">
                        <i class="fa-solid fa-download mr-1"></i> Download
                    </button>
                </td>
            </tr>
        `;
  });
}

// সিঙ্গেল রিপোর্ট ডাউনলোডের ফাংশন
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
// ৩. ইউজার একাউন্ট ইনফরমেশন
async function fetchUserAccountInfo() {
  const { data: profiles } = await _supabase.from("profiles").select("*");
  const { data: submissions } = await _supabase
    .from("file_submissions")
    .select("*");

  const tbody = document.getElementById("admin-users-table");
  if (!tbody || !profiles) return;
  tbody.innerHTML = "";

  profiles.forEach((user) => {
    let goodSum = 0;
    let badSum = 0;
    let totalAmt = 0;

    if (submissions) {
      submissions.forEach((sub) => {
        if (String(sub.user_id) === String(user.id)) {
          goodSum += Number(sub.good_count || 0);
          badSum += Number(sub.bad_count || 0);
          totalAmt += Number(sub.total_amount || 0);
        }
      });
    }

    tbody.innerHTML += `
            <tr class="border-b border-slate-100 text-xs">
                <td class="py-3 px-4 font-bold text-slate-800">${user.full_name || user.username}</td>
                <td class="py-3 px-4 font-bold text-emerald-600">${goodSum}</td>
                <td class="py-3 px-4 font-bold text-rose-500">${badSum}</td>
                <td class="py-3 px-4 font-bold text-purple-600">${totalAmt} BDT</td>
                <td class="py-3 px-4">
                    <span id="status-${user.id}" class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-600">Not Ready</span>
                </td>
                <td class="py-3 px-4">
                    <button onclick="sendPaymentToPending('${user.id}', ${goodSum}, ${totalAmt})" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-medium transition">
                        Pay (Send Pending)
                    </button>
                </td>
            </tr>
        `;
  });
}

async function sendPaymentToPending(userId, goodCount, amount) {
  const { error } = await _supabase.from("withdrawals").insert([
    {
      user_id: String(userId),
      good_count: goodCount,
      income: amount,
      status: "pending",
      bkash_number: "Admin Direct",
    },
  ]);

  if (error) {
    alert("Error: " + error.message);
  } else {
    alert("Payment request sent to pending successfully!");
    document.getElementById(`status-${userId}`).innerText = "Pending";
    document.getElementById(`status-${userId}`).className =
      "px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600";
    fetchPaymentInfo();
  }
}

// ৪. পেমেন্ট ইনফরমেশন
async function fetchPaymentInfo() {
  const { data: withdrawals, error } = await _supabase
    .from("withdrawals")
    .select("*")
    .eq("status", "pending");
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

  if (!withdrawals || withdrawals.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-slate-400 text-xs">No pending payment requests found.</td></tr>`;
    return;
  }

  withdrawals.forEach((item) => {
    const userName = profileMap[item.user_id] || "Unknown User";
    const formattedDate = item.created_at
      ? formatCustomDate(item.created_at)
      : "Today";

    tbody.innerHTML += `
            <tr class="border-b border-slate-100 text-xs">
                <td class="py-3 px-4 font-bold text-slate-800">${userName}</td>
                <td class="py-3 px-4 text-slate-600">${formattedDate}</td>
                <td class="py-3 px-4 font-bold text-emerald-600">${item.good_count || 0}</td>
                <td class="py-3 px-4 font-bold text-purple-600">${item.income || 0} BDT</td>
                <td class="py-3 px-4">
                    <button onclick="confirmPaymentSuccess('${item.id}')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-medium transition">
                        Pay Confirm
                    </button>
                </td>
            </tr>
        `;
  });
}

async function confirmPaymentSuccess(withdrawalId) {
  const { error } = await _supabase
    .from("withdrawals")
    .update({ status: "success" })
    .eq("id", withdrawalId);

  if (error) {
    alert("Failed to confirm payment: " + error.message);
  } else {
    alert("Payment confirmed successfully to Success!");
    fetchPaymentInfo();
  }
}

// কলামগুলোর সঠিক অর্ডার বজায় রাখার হেল্পার ফাংশন (Username -> Password -> 2FA -> Others)
function getOrderedAccount(acc) {
  if (!acc || typeof acc !== "object") return acc;
  const newObj = {};
  const keys = Object.keys(acc);

  // কলামগুলোর নাম শনাক্ত করা (বড়/ছোট হাতের অক্ষর মিলিয়ে)
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

  // প্রথমে Username, Password ও 2FA সেট করা হচ্ছে
  if (uKey) newObj[uKey] = acc[uKey];
  if (pKey) newObj[pKey] = acc[pKey];
  if (tKey) newObj[tKey] = acc[tKey];

  // এরপর বাকি কলামগুলো ক্রমানুসারে যুক্ত করা হচ্ছে
  keys.forEach((k) => {
    if (k !== uKey && k !== pKey && k !== tKey) {
      newObj[k] = acc[k];
    }
  });

  return newObj;
}

// বর্তমান ফিল্টার করা ডাটা কাস্টম ফরম্যাটে ফাইলনেমসহ ডাউনলোড করার ফাংশন
function downloadCurrentCategoryAllData() {
  const selectedDate = document.getElementById("report-date-filter").value;
  let combinedAccounts = [];
  let totalCount = 0;

  allSubmissions.forEach((sub) => {
    if (!sub.created_at) return;
    const subDateStr = sub.created_at.split("T")[0];

    // ক্যাটাগরি এবং ডেট ফিল্টার যাচাই করা হচ্ছে
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

  // ডাটা না থাকলে ডাউনলোড আটকাবে
  if (combinedAccounts.length === 0) {
    alert("No data available to download for this selection!");
    return;
  }

  // তারিখ ফরম্যাট তৈরি (যেমন: 16-08-2026) অথবা বর্তমান তারিখ যদি ফিল্টার করা না থাকে
  let datePart = "";
  if (selectedDate) {
    const parts = selectedDate.split("-"); // YYYY-MM-DD
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

  // ফাইলের নাম গঠন: date_categoryname_allCount-pis.xlsx
  const fileName = `${datePart}_${categoryName}_${totalCount}-pis.xlsx`;

  const worksheet = XLSX.utils.json_to_sheet(combinedAccounts);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  XLSX.writeFile(workbook, fileName);
}
