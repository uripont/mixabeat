import { config } from '../config.js';

export async function validateSession() {
    console.log('Checking auth state...');
    
    const token = localStorage.getItem('token');
    if (!token) {
        console.log('No token found, showing landing');
        return false;
    }
    
    try {
        // Try to list rooms as a way to validate the token
        // since there's no specific validation endpoint yet
        const response = await fetch(`${config.API_BASE_URL}/rooms`, {
            headers: {
                'Authorization': token,
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            console.log('Token invalid, showing landing');
            localStorage.clear();
            return false;
        }
        
        console.log('Valid token found, session validated');
        return true;
    } catch (error) {
        console.error('Auth validation error:', error);
        localStorage.clear();
        return false;
    }
}

export function requireAuth() {
    return validateSession().then(isValid => {
        if (!isValid) {
            console.log('Auth check failed, redirecting to landing');
            window.location.href = '/index.html';
            return false;
        }
        console.log('Auth valid, allowing access');
        return true;
    });
}
