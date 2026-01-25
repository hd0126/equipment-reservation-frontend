// API Base URL
const API_BASE_URL = 'https://equipment-reservation-backend.vercel.app/api';

// Token management
const setToken = (token) => {
  localStorage.setItem('token', token);
};

const getToken = () => {
  return localStorage.getItem('token');
};

const removeToken = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

const setUser = (user) => {
  localStorage.setItem('user', JSON.stringify(user));
};

const getUser = () => {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
};

const isAuthenticated = () => {
  return !!getToken();
};

const isAdmin = () => {
  const user = getUser();
  return user && user.role === 'admin';
};

// API request helper with authentication
const apiRequest = async (endpoint, options = {}) => {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // If body is FormData, remove Content-Type header to let browser set it with boundary
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    if (response.status === 401) {
      // Token expired or invalid
      removeToken();
      window.location.href = 'login.html';
    }
    throw new Error(data.error || 'Request failed');
  }

  return data;
};

// Login function
const login = async (email, password) => {
  try {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    setToken(data.token);
    setUser(data.user);
    return data.user;
  } catch (error) {
    throw error;
  }
};

// Register function
const register = async (username, email, password) => {
  try {
    const data = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });
    return data;
  } catch (error) {
    throw error;
  }
};

// Logout function
const logout = () => {
  removeToken();
  window.location.href = 'login.html';
};

// Get current user info
const getCurrentUser = async () => {
  try {
    const data = await apiRequest('/auth/me');
    setUser(data);
    return data;
  } catch (error) {
    throw error;
  }
};

// Check authentication on protected pages
const requireAuth = () => {
  if (!isAuthenticated()) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
};

// Check admin access
const requireAdmin = () => {
  if (!isAuthenticated() || !isAdmin()) {
    alert('관리자 권한이 필요합니다.');
    window.location.href = 'index.html';
    return false;
  }
  return true;
};

// Update UI based on authentication state
const updateAuthUI = () => {
  const user = getUser();
  const userInfo = document.getElementById('userInfo');
  const loginLink = document.getElementById('loginLink');
  const adminLink = document.getElementById('adminLink');

  if (user && userInfo) {
    userInfo.innerHTML = `
      <span class="navbar-text me-3">
        <i class="bi bi-person-circle"></i> ${user.username}
        ${user.role === 'admin' ? '<span class="badge bg-danger ms-1">관리자</span>' : ''}
      </span>
      <button class="btn btn-outline-danger btn-sm" onclick="logout()">
        <i class="bi bi-box-arrow-right"></i> 로그아웃
      </button>
    `;
    userInfo.style.display = 'flex';
    if (loginLink) loginLink.style.display = 'none';

    // Show admin link if user is admin
    if (adminLink && user.role === 'admin') {
      adminLink.style.display = 'block';
    }
  } else {
    if (userInfo) userInfo.style.display = 'none';
    if (loginLink) loginLink.style.display = 'block';
    if (adminLink) adminLink.style.display = 'none';
  }
};

// Show loading spinner
const showLoading = (container) => {
  if (container) {
    container.innerHTML = `
      <div class="spinner-container">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
      </div>
    `;
  }
};

// Show error message
const showError = (container, message) => {
  if (container) {
    container.innerHTML = `
      <div class="alert alert-danger" role="alert">
        <i class="bi bi-exclamation-triangle"></i> ${message}
      </div>
    `;
  }
};

// Show success message
const showSuccess = (container, message) => {
  if (container) {
    container.innerHTML = `
      <div class="alert alert-success" role="alert">
        <i class="bi bi-check-circle"></i> ${message}
      </div>
    `;
  }
};

// Format date
const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Format date for input field
const formatDateForInput = (dateString) => {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// Initialize auth UI on page load
document.addEventListener('DOMContentLoaded', () => {
  updateAuthUI();
});
