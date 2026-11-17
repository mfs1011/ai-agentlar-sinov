import { parseNumberInput, formatSom, groupErrors } from './lib.js';

const FIELDS = ['amount', 'months'];
const NETWORK_ERROR = 'Server bilan bog\'lanib bo\'lmadi. Internet aloqasini tekshirib, qaytadan urinib ko\'ring.';

const form = document.getElementById('calc-form');
const submitButton = document.getElementById('submit');
const formError = document.getElementById('form-error');
const result = document.getElementById('result');
const summary = document.getElementById('summary');
const paymentsBody = document.getElementById('payments');
const total = document.getElementById('total');

function setFieldError(field, message) {
  const input = form.elements[field];
  const errorEl = document.getElementById(`${field}-error`);
  errorEl.textContent = message ?? '';
  errorEl.hidden = !message;
  if (message) input.setAttribute('aria-invalid', 'true');
  else input.removeAttribute('aria-invalid');
}

function setFormError(messages) {
  formError.replaceChildren(...messages.map((m) => Object.assign(document.createElement('p'), { textContent: m })));
  formError.hidden = messages.length === 0;
}

function clearErrors() {
  for (const field of FIELDS) setFieldError(field, null);
  setFormError([]);
}

function showErrors(grouped) {
  for (const field of FIELDS) setFieldError(field, grouped[field]);
  setFormError(grouped.general);
  const firstInvalid = FIELDS.find((f) => grouped[f]);
  if (firstInvalid) form.elements[firstInvalid].focus();
}

/** "Birinchi 1 oy — 334 so'm, keyingi 2 oy — 333 so'm" */
function describe(payments) {
  const first = payments[0].amount;
  const last = payments.at(-1).amount;
  if (first === last) return `Har oy ${formatSom(first)}, ${payments.length} oy.`;
  const bigger = payments.filter((p) => p.amount === first).length;
  return `Birinchi ${bigger} oy — ${formatSom(first)}, keyingi ${payments.length - bigger} oy — ${formatSom(last)}.`;
}

function renderResult({ amount, payments }) {
  const rows = payments.map(({ month, amount: value }) => {
    const tr = document.createElement('tr');
    const monthCell = document.createElement('td');
    monthCell.textContent = `${month}-oy`;
    const valueCell = document.createElement('td');
    valueCell.className = 'num';
    valueCell.textContent = formatSom(value);
    tr.append(monthCell, valueCell);
    return tr;
  });
  paymentsBody.replaceChildren(...rows);

  const sum = payments.reduce((s, p) => s + p.amount, 0);
  total.textContent = formatSom(sum);
  summary.textContent = describe(payments);
  if (sum !== amount) console.error('Jami summaga teng emas', { amount, sum });

  result.hidden = false;
}

async function onSubmit(event) {
  event.preventDefault();
  clearErrors();

  const body = {
    amount: parseNumberInput(form.elements.amount.value),
    months: parseNumberInput(form.elements.months.value),
  };

  submitButton.disabled = true;
  form.setAttribute('aria-busy', 'true');
  try {
    const res = await fetch('/api/installments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);

    if (res.ok && data) {
      renderResult(data);
    } else {
      result.hidden = true;
      showErrors(groupErrors(data?.error));
    }
  } catch {
    result.hidden = true;
    setFormError([NETWORK_ERROR]);
  } finally {
    submitButton.disabled = false;
    form.removeAttribute('aria-busy');
  }
}

form.addEventListener('submit', onSubmit);

// Foydalanuvchi maydonni tuzata boshlasa, o'sha maydondagi xato yo'qoladi
for (const field of FIELDS) {
  form.elements[field].addEventListener('input', () => setFieldError(field, null));
}
