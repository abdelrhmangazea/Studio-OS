import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './lib/AuthContext'
import { PrefsProvider } from './lib/PrefsContext'
import { I18nProvider } from './i18n'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'

// The nesting matters:
//   ErrorBoundary outermost, so a crash in ANY provider is still caught
//   AuthProvider  knows who is signed in
//   PrefsProvider reads their theme + language off the profile
//   I18nProvider  translates using that language
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <PrefsProvider>
            <I18nProvider>
              <App />
            </I18nProvider>
          </PrefsProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
)
