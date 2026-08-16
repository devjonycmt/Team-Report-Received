// Supabase Configuration
const SUPABASE_URL = "https://gyybjzmbxmymajnpcqwv.supabase.co";
const SUPABASE_KEY = "sb_publishable_olnbtN1yKc3i_F_EL6GNzw_JZZZKMkb";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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
  // লোকাল সময় অনুযায়ী সঠিক আজকের তারিখ (YYYY-MM-DD) বের করার সঠিক পদ্ধতি
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const todayStr = `${year}-${month}-${day}`;

  const dateInput = document.getElementById("report-date-filter");
  if (dateInput) {
    dateInput.value = todayStr; // এটি এখন সঠিকভাবে আজকের তারিখ (১৭ তারিখ) সেট করবে

    // ডেট পরিবর্তন করলে সাথে সাথে ফিল্টার ও স্ট্যাটস আপডেট করার ইভেন্ট লিসেনার
    dateInput.addEventListener("change", function () {
      filterReportsAndStats();
    });
  }

  fetchAdminDashboardStats();
  fetchAdminReports();
  fetchUserAccountInfo();
  fetchPaymentInfo();
};

function switchTab(tabName) {
  // এখানে 'report-check' যুক্ত করা হলো
  const tabs = ["dashboard", "reports", "users", "payments", "report-check"];
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
    users: "User Reports",
    payments: "Payment Information",
    "report-check": "Report Check", // নতুন ট্যাবের টাইটেল
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

// ১. ড্যাশবোর্ড স্ট্যাটস (শুধু এই মাসের ডাটা রাখার জন্য)
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

    // এই মাসের ডাটা হিসাব করা
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

  // UI কার্ডগুলোতে শুধু মাসের মান বসানো
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

  // সরাসরি ফিল্টারকৃত ডাটা (filtered) থেকে হিসাব করা হচ্ছে (ডাবল লুপ বাদ দেওয়া হলো)
  filtered.forEach((sub) => {
    catSelectedTotal += Number(sub.account_count || 0);
    catSelectedGood += Number(sub.good_count || 0);
    catSelectedBad += Number(sub.bad_count || 0);
    catSelectedAmount += Number(sub.total_amount || 0);
  });

  // UI কার্ডগুলোর মান আপডেট করা
  document.getElementById("cat-today-total").innerText = catSelectedTotal;
  document.getElementById("cat-today-good").innerText = catSelectedGood;
  document.getElementById("cat-today-bad").innerText = catSelectedBad;
  document.getElementById("cat-today-amount").innerText =
    catSelectedAmount + " BDT";

  // টেবিল রেন্ডার করা
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
    tbody.innerHTML = `<tr><td colspan="9" class="py-4 text-center text-slate-400 text-xs">No reports found.</td></tr>`;
    return;
  }

  dataToRender.forEach((sub) => {
    const userName = allProfiles[sub.user_id] || "Unknown User";
    const formattedDate = formatCustomDate(sub.created_at);

    // স্ট্যাটস চেক ও Cancel বাটন যুক্ত করা
    const status = sub.status || "Pending";
    let statusHtml = "";
    if (status === "Received") {
      statusHtml = `
        <div class="flex items-center gap-2">
          <span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">Received</span>
          <button onclick="updateSubmissionStatus('${sub.id}', 'Pending')" class="bg-rose-500 hover:bg-rose-600 text-white px-2 py-1 rounded-md text-[10px] font-bold transition cursor-pointer shadow-sm" title="Cancel Received status">Cancel</button>
        </div>
      `;
    } else {
      statusHtml = `<button onclick="updateSubmissionStatus('${sub.id}', 'Received')" class="bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold transition shadow-sm cursor-pointer">Mark Received</button>`;
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
          <button onclick='downloadCategoryExcel(${JSON.stringify(sub.accounts_data || [])}, "${sub.category || "Report"}")' class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-medium transition cursor-pointer">
            <i class="fa-solid fa-download mr-1"></i> Download
          </button>
        </td>
      </tr>
    `;
  });
}
// স্ট্যাটস আপডেট করার ফাংশন (Received করার জন্য)
async function updateSubmissionStatus(subId, newStatus) {
  const { error } = await _supabase
    .from("file_submissions")
    .update({ status: newStatus })
    .eq("id", subId);

  if (error) {
    alert("Failed to update status: " + error.message);
  } else {
    // লোকাল অ্যারে আপডেট করে ফিল্টার ও রেন্ডার রিফ্রেশ করা
    const target = allSubmissions.find((s) => String(s.id) === String(subId));
    if (target) {
      target.status = newStatus;
    }
    filterReportsAndStats();
  }
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
// ৩. ইউজার রিপোর্টস ট্যাব (Received এবং payment_ready স্ট্যাটাসসহ)
async function fetchUserAccountInfo() {
  const { data: submissions, error } = await _supabase
    .from("file_submissions")
    .select("*")
    .in("status", ["Received", "payment_ready"])
    .order("created_at", { ascending: false });

  window.allSubmissions = submissions || [];

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
    tbody.innerHTML = `<tr><td colspan="9" class="py-4 text-center text-slate-400 text-xs">No reports found.</td></tr>`;
    return;
  }

  submissions.forEach((sub) => {
    const userName = profileMap[sub.user_id] || "Unknown User";
    const formattedDate = formatCustomDate(sub.created_at);
    const totalAmount = Number(sub.total_amount || 0);

    const existingReqId = payReqMap[sub.id];
    let actionHtml = "";
    let statusBadge = "";

    if (sub.status === "payment_ready") {
      statusBadge = `<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-50 text-purple-600 border border-purple-100">Payment Ready</span>`;
      actionHtml = `
        <button onclick="cancelPaymentPending('${existingReqId || ""}', '${sub.id}')" class="bg-rose-500 hover:bg-rose-600 text-white px-3 py-1.5 rounded-lg font-medium transition cursor-pointer shadow-sm">
          Cancel Pending
        </button>
      `;
    } else {
      statusBadge = `<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">Received</span>`;
      actionHtml = `
        <button onclick="sendPaymentToPending('${sub.id}')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-medium transition cursor-pointer shadow-sm">
          Payment Pending
        </button>
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
async function calculateAndUpdateAmounts() {
  const rateRegular =
    Number(document.getElementById("rate-regular").value) || 5;
  const rate100 = Number(document.getElementById("rate-100").value) || 5.1;
  const rate500 = Number(document.getElementById("rate-500").value) || 5.3;

  if (!window.allSubmissions || window.allSubmissions.length === 0) {
    alert("No submissions available to update!");
    return;
  }

  if (
    !confirm(
      "Are you sure you want to calculate and update total amounts for all listed user reports?",
    )
  ) {
    return;
  }

  let updatedCount = 0;

  for (const sub of window.allSubmissions) {
    const goodCount = Number(sub.good_count || 0);
    let calculatedAmount = 0;

    // গুড অ্যাকাউন্ট শূন্যের বেশি হলে রেট হিসাব হবে, নতুবা অ্যামাউন্ট ০ থাকবে
    if (goodCount > 0) {
      let currentRate = rateRegular;

      if (goodCount >= 500) {
        currentRate = rate500;
      } else if (goodCount >= 100) {
        currentRate = rate100;
      }

      calculatedAmount = Number((goodCount * currentRate).toFixed(2));
    }

    const { error } = await _supabase
      .from("file_submissions")
      .update({ total_amount: calculatedAmount })
      .eq("id", sub.id);

    if (!error) {
      updatedCount++;
    } else {
      console.error("Error updating amount for ID:", sub.id, error.message);
    }
  }

  alert(`Successfully updated total amount for ${updatedCount} reports!`);
  fetchUserAccountInfo();
}

// Payment Pending বাটনে ক্লিক করলে payment_requests টেবিলে status 'payment_ready' হিসেবে জমা হবে
async function sendPaymentToPending(subId) {
  const sub = allSubmissions.find((s) => String(s.id) === String(subId));
  if (!sub) {
    alert("Submission data not found!");
    return;
  }

  // ১. payment_requests টেবিলে status 'payment_ready' দিয়ে ইনসার্ট করা
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
        status: "payment_ready", // এখানে 'pending' এর পরিবর্তে 'payment_ready' করা হলো
      },
    ]);

  if (insertError) {
    alert("Error: " + insertError.message);
    return;
  }

  // ২. file_submissions টেবিলের স্ট্যাটাসও 'payment_ready' আপডেট করা
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

// Cancel Pending বাটনে ক্লিক করলে রিকোয়েস্ট ডিলিট হবে এবং স্ট্যাটাস আবার 'Received' হবে
async function cancelPaymentPending(requestId, subId) {
  if (requestId) {
    await _supabase.from("payment_requests").delete().eq("id", requestId);
  } else {
    // ব্যাকআপ হিসেবে submission_id দিয়ে ডিলিট করা
    await _supabase
      .from("payment_requests")
      .delete()
      .eq("submission_id", subId);
  }

  // file_submissions টেবিলের স্ট্যাটাস পুনরায় Received করা
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

// পেমেন্ট ইনফরমেশন এবং স্ট্যাটাস কার্ড লোড করার ফাংশন
async function fetchPaymentInfo() {
  const { data: requests, error } = await _supabase
    .from("payment_requests")
    .select("*")
    .in("status", ["payment_ready", "success"])
    .order("created_at", { ascending: false });

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

  if (!requests || requests.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="py-4 text-center text-slate-400 text-xs">No payment requests found.</td></tr>`;
    document.getElementById("stat-total-ready").innerText = "0 BDT";
    document.getElementById("stat-total-success").innerText = "0 BDT";
    document.getElementById("stat-success-count").innerText = "0";
    return;
  }

  let totalReadyAmount = 0;
  let totalSuccessAmount = 0;
  let successCount = 0;

  // ১. টোটাল অ্যামাউন্ট হিসাব করা
  requests.forEach((item) => {
    const itemAmount = Number(item.total_amount) || 0;
    if (item.status === "payment_ready") {
      totalReadyAmount += itemAmount;
    } else if (item.status === "success") {
      totalSuccessAmount += itemAmount;
      successCount++;
    }
  });

  // ২. টপ কার্ডগুলোতে মান বসানো
  document.getElementById("stat-total-ready").innerText =
    totalReadyAmount + " BDT";
  document.getElementById("stat-total-success").innerText =
    totalSuccessAmount + " BDT";
  document.getElementById("stat-success-count").innerText = successCount;

  // ৩. টেবিল রো রেন্ডার করা
  requests.forEach((item) => {
    const userName = profileMap[item.user_id] || "Unknown User";
    const formattedDate = item.created_at
      ? formatCustomDate(item.created_at)
      : "N/A";
    const itemAmount = Number(item.total_amount) || 0; // সঠিকভাবে অ্যামাউন্ট ডিফাইন করা হলো

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
// পেমেন্ট কনফার্ম করার ফাংশন (স্ট্যাটাস success করা)
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

// ভুলবশত পেমেন্ট হয়ে গেলে তা বাতিল করে পুনরায় payment_ready এ ফিরিয়ে আনা
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
// হার্ডকোড করা অ্যাকাউন্ট রেট
const ACCOUNT_RATES = {
  regular: 5,
  rate100: 5.1,
  rate500: 5.3,
};

async function processReportCheck() {
  const categorySelect = document.getElementById("report-category-select");
  const selectedCategory = categorySelect ? categorySelect.value : "";
  const textarea = document.getElementById("good-accounts-input");
  const rawData = textarea ? textarea.value.trim() : "";

  if (!selectedCategory) {
    alert("Please select a category first!");
    return;
  }

  if (!rawData) {
    alert("Please paste some usernames first!");
    return;
  }

  const goodList = new Set(
    rawData
      .split("\n")
      .map((u) => u.trim().toLowerCase())
      .filter(Boolean),
  );

  const { data: submissions, error } = await _supabase
    .from("file_submissions")
    .select("*")
    .eq("category", selectedCategory);

  if (error) {
    alert("Error fetching submissions: " + error.message);
    return;
  }

  if (!submissions || submissions.length === 0) {
    alert(`No submissions found for the category: ${selectedCategory}`);
    return;
  }

  let totalUpdated = 0;

  for (const sub of submissions) {
    let goodCount = 0;
    let badCount = 0;
    let parsedData = [];

    if (sub.accounts_data) {
      try {
        parsedData =
          typeof sub.accounts_data === "string"
            ? JSON.parse(sub.accounts_data)
            : sub.accounts_data;
      } catch (e) {
        console.error("Error parsing accounts_data for submission ID:", sub.id);
      }
    }

    if (Array.isArray(parsedData) && parsedData.length > 0) {
      parsedData.forEach((acc) => {
        let dbUsername = "";

        if (typeof acc === "object" && acc !== null) {
          const foundKey = Object.keys(acc).find(
            (k) => k.toLowerCase() === "username",
          );
          if (foundKey) {
            dbUsername = String(acc[foundKey]).trim().toLowerCase();
          } else {
            const values = Object.values(acc);
            if (values.length > 0)
              dbUsername = String(values[0]).trim().toLowerCase();
          }
        }

        if (dbUsername) {
          if (goodList.has(dbUsername)) {
            goodCount++;
          } else {
            badCount++;
          }
        } else {
          badCount++;
        }
      });
    }

    // হার্ডকোড করা রেট অনুযায়ী স্বয়ংক্রিয়ভাবে মোট অ্যামাউন্ট হিসাব করা
    let totalAmount = 0;
    if (goodCount > 0) {
      let currentRate = ACCOUNT_RATES.regular;

      if (goodCount >= 500) {
        currentRate = ACCOUNT_RATES.rate500;
      } else if (goodCount >= 100) {
        currentRate = ACCOUNT_RATES.rate100;
      }

      totalAmount = Number((goodCount * currentRate).toFixed(2));
    }

    // গুড, ব্যাড এবং টোটাল অ্যামাউন্ট একসাথে আপডেট করা
    const { error: updateError } = await _supabase
      .from("file_submissions")
      .update({
        good_count: goodCount,
        bad_count: badCount,
        total_amount: totalAmount,
      })
      .eq("id", sub.id);

    if (!updateError) {
      totalUpdated++;
    } else {
      console.error("Update error:", updateError.message);
    }
  }

  alert(
    `Report processed successfully! Updated ${totalUpdated} submissions for ${selectedCategory}.`,
  );

  if (textarea) textarea.value = "";
  if (typeof fetchAllReports === "function") fetchAllReports();
}
// ট্যাব সুইচ বা পরিবর্তন করার ফাংশন
function showTab(tabId) {
  // ১. আইডি তে 'tab-' দিয়ে শুরু হওয়া সকল সেকশন/ট্যাবগুলো হাইড করা
  const allTabs = document.querySelectorAll('[id^="tab-"]');
  allTabs.forEach((tab) => {
    tab.classList.add("hidden");
  });

  // ২. কাঙ্ক্ষিত ট্যাবটি খুঁজে বের করে ভিজিবল বা শো করা
  const targetTab = document.getElementById(tabId);
  if (targetTab) {
    targetTab.classList.remove("hidden");
  }

  // ৩. যদি Report Check ট্যাব হয়, তবে রিলোড বা প্রয়োজনীয় ডাটা ফেচ করার ফাংশন কল করতে পারেন
  if (
    tabId === "tab-report-check" &&
    typeof fetchReportCheckData === "function"
  ) {
    fetchReportCheckData();
  }
}

async function resetReportCheck() {
  const categorySelect = document.getElementById("report-category-select");
  const selectedCategory = categorySelect ? categorySelect.value : "";

  if (!selectedCategory) {
    alert("Please select a category first!");
    return;
  }

  if (
    !confirm(
      `Are you sure you want to reset all good/bad counts and amount to 0 for category: ${selectedCategory}?`,
    )
  ) {
    return;
  }

  const { data: submissions, error } = await _supabase
    .from("file_submissions")
    .select("*")
    .eq("category", selectedCategory);

  if (error) {
    alert("Error fetching submissions: " + error.message);
    return;
  }

  if (!submissions || submissions.length === 0) {
    alert(`No submissions found for the category: ${selectedCategory}`);
    return;
  }

  let totalReset = 0;

  for (const sub of submissions) {
    const { error: updateError } = await _supabase
      .from("file_submissions")
      .update({
        good_count: 0,
        bad_count: 0,
        total_amount: 0, // গুড কাউন্ট জিরো হওয়ার সাথে সাথে টোটাল অ্যামাউন্টও জিরো হয়ে যাবে
      })
      .eq("id", sub.id);

    if (!updateError) {
      totalReset++;
    } else {
      console.error("Reset error:", updateError.message);
    }
  }

  alert(
    `Successfully reset counts and amount to 0 for ${totalReset} submissions in ${selectedCategory}.`,
  );

  if (typeof fetchAdminReports === "function") {
    fetchAdminReports();
  }
}
