import { config } from '../config.js';

export async function validateSession() {
    const token = localStorage.getItem('token');
    if (!token) {
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
            localStorage.clear();
            return false;
        }
        
        return true;
    } catch (error) {
        localStorage.clear();
        return false;
    }
}

export function requireAuth() {
    return validateSession().then(isValid => {
        if (!isValid) {
            window.location.href = '/index.html';
            return false;
        }
        return true;
    });
}
