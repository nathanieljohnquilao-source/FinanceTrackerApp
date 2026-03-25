/* =====================================================
   LEDGER — app.js
   All logic: state, localStorage, rendering, filters
   ===================================================== */

'use strict';

/* ── STATE ───────────────────────────────────────── */
let transactions = JSON.parse(localStorage.getItem('ledger_transactions') || '[]');
let selectedType = 'income';
let filterType   = 'all';
let filterMonth  = '';

/* ── INIT ────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  setTodayDate();
  populateMonthFilter();
  render();
});

function setTodayDate() {
  const now = new Date();
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById('today-date').textContent = now.toLocaleDateString('en-US', options);

  // Default date input to today
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  document.getElementById('f-date').value = `${y}-${m}-${d}`;
}

/* ── TYPE TOGGLE ─────────────────────────────────── */
function selectType(type) {
  selectedType = type;
  document.getElementById('btn-income').classList.toggle('active', type === 'income');
  document.getElementById('btn-expense').classList.toggle('active', type === 'expense');
}

/* ── ADD TRANSACTION ─────────────────────────────── */
function addTransaction() {
  const desc   = document.getElementById('f-desc').value.trim();
  const amount = parseFloat(document.getElementById('f-amount').value);
  const cat    = document.getElementById('f-category').value;
  const date   = document.getElementById('f-date').value;

  if (!desc)          { showToast('Please enter a description.', 'error'); return; }
  if (!amount || amount <= 0) { showToast('Please enter a valid amount.', 'error'); return; }
  if (!cat)           { showToast('Please select a category.', 'error'); return; }
  if (!date)          { showToast('Please pick a date.', 'error'); return; }

  const tx = {
    id:     Date.now(),
    type:   selectedType,
    desc,
    amount: Math.round(amount * 100) / 100,
    cat,
    date,
  };

  transactions.unshift(tx);
  save();

  // Reset form (keep type & date)
  document.getElementById('f-desc').value   = '';
  document.getElementById('f-amount').value = '';
  document.getElementById('f-category').value = '';

  populateMonthFilter();
  render();
  showToast(`${selectedType === 'income' ? 'Income' : 'Expense'} recorded ✓`, 'success');
}

/* ── DELETE ──────────────────────────────────────── */
function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  save();
  populateMonthFilter();
  render();
  showToast('Entry removed.');
}

/* ── CLEAR ALL ───────────────────────────────────── */
function clearAll() {
  if (!transactions.length) return;
  if (!confirm('Clear all transactions? This cannot be undone.')) return;
  transactions = [];
  save();
  filterType  = 'all';
  filterMonth = '';
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('[data-filter="all"]').classList.add('active');
  document.getElementById('month-filter').value = '';
  populateMonthFilter();
  render();
  showToast('All entries cleared.');
}

/* ── FILTERS ─────────────────────────────────────── */
function setFilter(type, el) {
  filterType = type;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  render();
}

function applyFilters() {
  filterMonth = document.getElementById('month-filter').value;
  render();
}

function getFiltered() {
  return transactions.filter(t => {
    const typeMatch  = filterType === 'all' || t.type === filterType;
    const monthMatch = !filterMonth || t.date.startsWith(filterMonth);
    return typeMatch && monthMatch;
  });
}

function populateMonthFilter() {
  const months = [...new Set(transactions.map(t => t.date.slice(0, 7)))].sort().reverse();
  const select = document.getElementById('month-filter');
  const current = select.value;
  select.innerHTML = '<option value="">All months</option>' +
    months.map(m => {
      const [y, mo] = m.split('-');
      const label = new Date(+y, +mo - 1, 1).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      return `<option value="${m}"${m === current ? ' selected' : ''}>${label}</option>`;
    }).join('');
}

/* ── RENDER ──────────────────────────────────────── */
function render() {
  renderSummary();
  renderLedger();
  renderChart();
}

/* ── SUMMARY ─────────────────────────────────────── */
function renderSummary() {
  const income  = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const net     = income - expense;
  const rate    = income > 0 ? Math.round((net / income) * 100) : 0;

  const balEl = document.getElementById('net-balance');
  balEl.textContent = fmt(Math.abs(net));
  balEl.className   = 'summary-value balance';
  if (net < 0) balEl.style.color = '#eb8b96';
  else balEl.style.color = '';

  document.getElementById('total-income').textContent  = fmt(income);
  document.getElementById('total-expense').textContent = fmt(expense);
  document.getElementById('savings-rate').textContent  = rate + '%';
}

/* ── LEDGER ──────────────────────────────────────── */
function renderLedger() {
  const filtered = getFiltered();
  const body = document.getElementById('ledger-body');

  if (!filtered.length) {
    body.innerHTML = `
      <div class="ledger-empty">
        <span class="ledger-empty-icon">⊘</span>
        <p>${transactions.length ? 'No entries match your filter.' : 'Your ledger is empty.'}</p>
        <p>${transactions.length ? 'Try changing the filter above.' : 'Add an entry to get started.'}</p>
      </div>`;
    return;
  }

  const rows = filtered.map(t => {
    const sign = t.type === 'income' ? '+' : '−';
    return `
      <div class="ledger-row">
        <span class="row-date">${formatDate(t.date)}</span>
        <span class="row-desc" title="${escHtml(t.desc)}">${escHtml(t.desc)}</span>
        <span class="row-cat">${t.cat}</span>
        <span class="row-amount ${t.type}">${sign}${fmt(t.amount)}</span>
        <button class="row-del" onclick="deleteTransaction(${t.id})" title="Delete entry">×</button>
      </div>`;
  }).join('');

  // Running net of filtered transactions
  const net = filtered.reduce((s, t) => t.type === 'income' ? s + t.amount : s - t.amount, 0);
  const totalRow = `
    <div class="ledger-total-row">
      <span class="total-label">Net (filtered)</span>
      <span class="total-amount ${net >= 0 ? 'positive' : 'negative'}">${net >= 0 ? '+' : '−'}${fmt(Math.abs(net))}</span>
      <span></span>
    </div>`;

  body.innerHTML = rows + totalRow;
}

/* ── CHART ───────────────────────────────────────── */
function renderChart() {
  const expenses = transactions.filter(t => t.type === 'expense');
  const body = document.getElementById('chart-body');

  if (!expenses.length) {
    body.innerHTML = '<div class="chart-empty">No expense data yet</div>';
    document.getElementById('chart-period').textContent = 'All time';
    return;
  }

  // Group by category
  const totals = {};
  expenses.forEach(t => {
    totals[t.cat] = (totals[t.cat] || 0) + t.amount;
  });

  const sorted  = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const grandTotal = sorted.reduce((s, [, v]) => s + v, 0);

  document.getElementById('chart-period').textContent = `${fmt(grandTotal)} total`;

  body.innerHTML = sorted.map(([cat, total]) => {
    const pct = Math.round((total / grandTotal) * 100);
    return `
      <div class="bar-row">
        <div class="bar-meta">
          <span class="bar-label">${cat}</span>
          <span class="bar-amount">${fmt(total)}</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width: ${pct}%"></div>
        </div>
        <div class="bar-pct">${pct}% of expenses</div>
      </div>`;
  }).join('');

  // Animate bars in after a tick (allows CSS transition to run)
  requestAnimationFrame(() => {
    document.querySelectorAll('.bar-fill').forEach(el => {
      const target = el.style.width;
      el.style.width = '0%';
      requestAnimationFrame(() => { el.style.width = target; });
    });
  });
}

/* ── UTILITIES ───────────────────────────────────── */
function save() {
  localStorage.setItem('ledger_transactions', JSON.stringify(transactions));
}

function fmt(n) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  const date = new Date(+y, +m - 1, +d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.className = 'toast'; }, 2800);
}
