import React from 'react';
import ReactDOM from 'react-dom/client';
import axios from 'axios';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

if (process.env.REACT_APP_DASHBOARD_API_KEY) {
  axios.defaults.headers.common['x-api-key'] = process.env.REACT_APP_DASHBOARD_API_KEY;
}
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals();
