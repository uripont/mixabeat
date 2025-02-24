const API_URL = 'http://20.26.232.219:3000';

async function login(username, password) {
    console.log('Attempting login to:', `${API_URL}/login`);
    const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
        const error = await response.text();
        console.error('Login failed:', error);
        throw new Error(error || 'Login failed');
    }

    const data = await response.json();
    return data;
}

async function signup(username, email, password) {
    console.log('Attempting signup to:', `${API_URL}/signUp`);
    const response = await fetch(`${API_URL}/signUp`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
            username, 
            password,
            email
        })
    });

    if (!response.ok) {
        const error = await response.text();
        console.error('Signup failed:', error);
        throw new Error(error || 'Signup failed');
    }

    return await response.json();
}

export { login, signup };
