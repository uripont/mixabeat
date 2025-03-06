import { login, signup } from './auth-api.js';

// UI Elements
const errorMessageElement = document.getElementById('error-message');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const loginButton = document.getElementById('login-button');
const signupButton = document.getElementById('signup-button');

// Helper functions
function showError(message) {
    errorMessageElement.textContent = message;
    errorMessageElement.classList.remove('hidden');
    setTimeout(() => {
        errorMessageElement.classList.add('hidden');
    }, 5000);
}

function setLoading(button, isLoading) {
    button.disabled = isLoading;
    button.textContent = isLoading ? 'Loading...' : button.textContent.replace('Loading...', button.dataset.originalText || 'Submit');
    if (!isLoading) button.dataset.originalText = button.textContent;
}

function validateInput(inputs) {
    for (const [field, value] of Object.entries(inputs)) {
        if (!value || value.trim() === '') {
            throw new Error(`${field.charAt(0).toUpperCase() + field.slice(1)} is required`);
        }
    }
    
    // Basic email validation for signup
    if (inputs.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inputs.email)) {
        throw new Error('Please enter a valid email address');
    }

    // Basic password validation
    if (inputs.password && inputs.password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
    }
}

function handleAuthSuccess(result, message) {
    // Store user info
    localStorage.setItem('userId', result.userId);
    localStorage.setItem('username', result.username);
    
    console.log(message, result);
    
    // Clear any previous errors
    errorMessageElement.classList.add('hidden');
    
    // Small delay to show success before redirect
    setTimeout(() => {
        window.location.href = '/index.html';
    }, 500);
}

// Toggle between login and signup forms
document.getElementById('show-signup').addEventListener('click', function(e) {
    e.preventDefault();
    loginForm.classList.add('hidden');
    signupForm.classList.remove('hidden');
    errorMessageElement.classList.add('hidden');
});

document.getElementById('show-login').addEventListener('click', function(e) {
    e.preventDefault();
    signupForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
    errorMessageElement.classList.add('hidden');
});

// Login form submission
loginButton.addEventListener('click', async function(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        // Validate input
        validateInput({ username, password });

        // Start loading state
        setLoading(loginButton, true);

        const result = await login(username, password);
        handleAuthSuccess(result, 'Login successful:');
    } catch (error) {
        console.error('Login error:', error);
        showError(error.message || 'Login failed. Please try again.');
    } finally {
        setLoading(loginButton, false);
    }
});

// Signup form submission
signupButton.addEventListener('click', async function(e) {
    e.preventDefault();
    
    const username = document.getElementById('signup-username').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;

    try {
        // Validate input
        validateInput({ username, email, password });

        // Start loading state
        setLoading(signupButton, true);

        const result = await signup(username, email, password);
        handleAuthSuccess(result, 'Signup successful:');
    } catch (error) {
        console.error('Signup error:', error);
        showError(error.message || 'Signup failed. Please try again.');
    } finally {
        setLoading(signupButton, false);
    }
});
