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
    localStorage.setItem('authToken', result.authToken);

    console.log(message, result);
    console.log('authToken stored:', localStorage.getItem('authToken'));
    console.log('Redirecting to room selection...');
    
    // Clear any previous errors
    errorMessageElement.classList.add('hidden');
    
    // Small delay to show success before redirect
    setTimeout(() => {
        window.location.href = '../search/search.html';
    }, 1000);
}

// Toggle between login and signup forms
document.getElementById('show-signup').addEventListener('click', function(e) {
    e.preventDefault();
    console.log('Switching to signup form');
    loginForm.classList.add('hidden');
    signupForm.classList.remove('hidden');
    errorMessageElement.classList.add('hidden');
});

document.getElementById('show-login').addEventListener('click', function(e) {
    e.preventDefault();
    console.log('Switching to login form');
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
        console.log('Login attempt for username:', username);
        
        // Validate input
        validateInput({ username, password });
        console.log('Login validation passed');

        // Start loading state
        setLoading(loginButton, true);

        const result = await login(username, password);
        console.log('Login successful');
        handleAuthSuccess(result, 'Login successful:');
    } catch (error) {
        console.error('Login failed:', error);
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
        console.log('Signup attempt for username:', username);
        
        // Validate input
        validateInput({ username, email, password });
        console.log('Signup validation passed');

        // Start loading state
        setLoading(signupButton, true);

        const result = await signup(username, email, password);
        console.log('Signup successful');
        console.log('Auto-login after signup...');
        handleAuthSuccess(result, 'Signup successful:');
    } catch (error) {
        console.error('Signup failed:', error);
        showError(error.message || 'Signup failed. Please try again.');
    } finally {
        setLoading(signupButton, false);
    }
});
