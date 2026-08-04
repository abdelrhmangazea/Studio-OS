import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './lib/AuthContext'
import { PrefsProvider } from './lib/PrefsContext'
import { I18nProvider } from './i18n'
import './index.css'

// The nesting matters:
//   AuthProvider  knows who is signed in
//   PrefsProvider reads their theme + language off the profile
//   I18nProvider  translates using that language
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PrefsProvider>
          <I18nProvider>
            <App />
          </I18nProvider>
        </PrefsProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
