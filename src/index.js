import React from 'react';
import ReactDOM from 'react-dom/client';
import axios from 'axios';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const _apiKey = process.env.REACT_APP_DASHBOARD_API_KEY;
if (_apiKey) {
  axios.defaults.headers.common['x-api-key'] = _apiKey;
}
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals();
