import { config } from '../utils/config.js';

async function login(username, password) {
    console.log('Attempting login...');
    const response = await fetch(`${config.API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ username, password })
    });

    const data = await response.json().catch(() => response.text());
    
    console.log('Login Response:', response); // Log the raw response
    console.log('Login Data:', data); // Log the parsed data

    if (!response.ok) {
        console.error('Login failed:', data);
        throw new Error(typeof data === 'string' ? data : data.message || 'Login failed');
    }
    // Store token for future authenticated requests
    localStorage.setItem('authToken', data.token);
    return { ...data, authToken: data.token };
}

async function signup(username, email, password) {
    console.log('Attempting signup...');
    const response = await fetch(`${config.API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ 
            username, 
            email,
            password
        })
    });

    const data = await response.json().catch(() => response.text());
    
    console.log('Signup Response:', response); // Log the raw response
    console.log('Signup Data:', data); // Log the parsed data
    
    if (!response.ok) {
        console.error('Signup failed:', data);
        throw new Error(typeof data === 'string' ? data : data.message || 'Signup failed');
    }
    // Store token for future authenticated requests
    localStorage.setItem('authToken', data.token);
    return { ...data, authToken: data.token };
}

async function logout() {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    console.log('Logging out...');
    try {
        const response = await fetch(`${config.API_BASE_URL}/auth/logout`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json().catch(() => response.text());
        if (!response.ok) {
            console.error('Logout failed:', data);
            throw new Error(typeof data === 'string' ? data : data.message || 'Logout failed');
        }
    } catch (error) {
        console.error('Logout error:', error);
    } finally {
        localStorage.removeItem('authToken');
    }
}

export { login, signup, logout };
