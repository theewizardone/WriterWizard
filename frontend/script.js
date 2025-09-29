
const BACKEND_URL = 'http://localhost:5001';
const inputText = document.getElementById('inputText');
const outputArea = document.getElementById('outputArea');
const wordCountElement = document.getElementById('wordCount');
const humanizeBtn = document.getElementById('humanizeBtn');
const copyBtn = document.getElementById('copyBtn');
const authSection = document.getElementById('authSection');
const loginSection = document.getElementById('loginSection');
const registerSection = document.getElementById('registerSection');
let selectedPlan = null;
let paymentSessionId = null;
let authToken = localStorage.getItem('authToken');
let currentUser = null;

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'none';
}

function updateWordCount() {
    const text = inputText.value;
    const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
    wordCountElement.textContent = words;
    if (words > 1500) {
        wordCountElement.style.color = '#ef4444';
    } else if (words > 1000) {
        wordCountElement.style.color = '#f59e0b';
    } else {
        wordCountElement.style.color = '';
    }
}
inputText.addEventListener('input', updateWordCount);

function showLogin() {
    loginSection.style.display = 'block';
    registerSection.style.display = 'none';
    authSection.style.display = 'none';
}
function showRegister() {
    loginSection.style.display = 'none';
    registerSection.style.display = 'block';
    authSection.style.display = 'none';
}
function showAuth() {
    loginSection.style.display = 'none';
    registerSection.style.display = 'none';
    authSection.style.display = 'block';
}

async function login() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    if (!email || !password) return alert('Enter email and password');
    try {
        const res = await fetch(`${BACKEND_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (res.ok) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('authToken', authToken);
            showAuth(); updateUserInfo();
        } else alert(data.error || 'Login failed');
    } catch (err) { alert('Login error: ' + err.message); }
}

async function register() {
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const confirm = document.getElementById('registerConfirmPassword').value;
    if (!email || !password || !confirm) return alert('Fill all fields');
    if (password !== confirm) return alert('Passwords do not match');
    try {
        const res = await fetch(`${BACKEND_URL}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (res.ok) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('authToken', authToken);
            showAuth(); updateUserInfo();
            alert('Registration successful! You have received 10 free credits.');
        } else alert(data.error || 'Registration failed');
    } catch (err) { alert('Register error: ' + err.message); }
}

function logout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    showLogin();
}

async function fetchUserInfo() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/user`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (res.ok) {
            const data = await res.json();
            currentUser = data.user;
            showAuth(); updateUserInfo();
        } else logout();
    } catch { logout(); }
}

function updateUserInfo() {
    if (currentUser) {
        document.getElementById('userEmail').textContent = currentUser.email;
        document.getElementById('userPlan').textContent = currentUser.plan;
        document.getElementById('userCredits').textContent = currentUser.credits;
    }
}
if (authToken) fetchUserInfo();

function showPaymentModal() {
    loadPricingPlans();
    document.getElementById('paymentModal').style.display = 'flex';
    document.getElementById('stripePayment').style.display = 'none';
    document.getElementById('mpesaPayment').style.display = 'none';
    selectedPlan = null;
    document.querySelectorAll('.payment-btn').forEach(b => b.disabled = true);
}

async function loadPricingPlans() {
    const res = await fetch(`${BACKEND_URL}/api/pricing-plans`);
    const plans = await res.json();
    const container = document.getElementById('pricingPlans');
    container.innerHTML = '';
    plans.forEach(plan => {
        const div = document.createElement('div');
        div.className = 'plan-card';
        div.onclick = () => selectPlan(plan, div);
        div.innerHTML = `<h4>${plan.name}</h4>
            <div class="plan-price">$${plan.price}</div>
            <ul>${plan.features.map(f => `<li>${f}</li>`).join('')}</ul>`;
        container.appendChild(div);
    });
}

function selectPlan(plan, el) {
    selectedPlan = plan;
    document.querySelectorAll('.plan-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    document.querySelectorAll('.payment-btn').forEach(b => b.disabled = false);
}

// Update initiateStripePayment to send priceId
async function initiateStripePayment() {
    if (!selectedPlan || !selectedPlan.stripePriceId) return alert('Select a plan first');
    try {
        const res = await fetch(`${BACKEND_URL}/api/create-stripe-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ priceId: selectedPlan.stripePriceId })
        });
        const data = await res.json();
        if (res.ok && data.url) {
            window.location.href = data.url; // Redirect to Stripe
        } else {
            alert(data.error || 'Stripe payment failed');
        }
    } catch (err) {
        alert('Stripe error: ' + err.message);
    }
}

function showStripePayment() {
    if (!selectedPlan) return alert('Select a plan first');
    document.getElementById('stripePayment').style.display = 'block';
    document.getElementById('mpesaPayment').style.display = 'none';
}
function showMpesaPayment() {
    if (!selectedPlan) return alert('Select a plan first');
    document.getElementById('mpesaPayment').style.display = 'block';
    document.getElementById('stripePayment').style.display = 'none';
}

async function initiateMpesaPayment() {
    if (!selectedPlan) return alert('Select a plan first');
    const phone = document.getElementById('mpesaPhone').value;
    if (!phone || !phone.startsWith('254')) return alert('Enter valid 254... number');
    try {
        const res = await fetch(`${BACKEND_URL}/api/mpesa/pay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json','Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({
                phone,
                amount: selectedPlan.price,
                accountReference: 'WriterWizard',
                transactionDesc: `Upgrade to ${selectedPlan.name}`
            })
        });
        const data = await res.json();
        if (res.ok) {
            paymentSessionId = data.data.CheckoutRequestID;
            showPaymentProcessing('STK Push sent. Complete payment on your phone.');
            checkPaymentStatus();
        } else alert(data.error || 'M-Pesa init failed');
    } catch (err) { alert('M-Pesa error: ' + err.message); }
}

function showPaymentProcessing(msg) {
    document.getElementById('paymentStatusMessage').textContent = msg;
    document.getElementById('paymentProcessingModal').style.display = 'flex';
    document.getElementById('paymentModal').style.display = 'none';
}

async function checkPaymentStatus() {
    if (!paymentSessionId) return;
    try {
        const res = await fetch(`${BACKEND_URL}/api/payment-status/${paymentSessionId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            alert('Payment successful! Credits added.');
            document.getElementById('paymentProcessingModal').style.display = 'none';
            fetchUserInfo();
        } else {
            setTimeout(checkPaymentStatus, 5000);
        }
    } catch { setTimeout(checkPaymentStatus, 5000); }
}

// Dark/Light mode toggle
const toggleCheckbox = document.getElementById('themeCheckbox');

if (toggleCheckbox) {
    toggleCheckbox.addEventListener('change', () => {
        document.body.classList.toggle('dark-theme');
    });
}


async function humanize() {
    const text = inputText.value.trim();
    if (!text) return alert('Enter text to humanize');
    humanizeBtn.disabled = true;
    humanizeBtn.textContent = 'Processing...';
    try {
        const res = await fetch(`${BACKEND_URL}/api/humanize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json','Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ text })
        });
        const data = await res.json();
        if (res.ok) outputArea.textContent = data.humanizedText;
        else alert(data.error || 'Humanize failed');
    } catch (err) { alert('Error: ' + err.message); }
    finally {
        humanizeBtn.disabled = false;
        humanizeBtn.textContent = 'Humanize';
    }
}
humanizeBtn.addEventListener('click', humanize);

function loadSample() {
    inputText.value = "This is a sample AI-generated text that needs to be humanized.";
    updateWordCount();
}
function clearText() {
    inputText.value = "";
    outputArea.textContent = "Your humanized text will appear here...";
    updateWordCount();
}

copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(outputArea.textContent);
    alert('Copied to clipboard');
});
