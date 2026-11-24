import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import './styles/base.css';
import './styles/shell.css';
import './styles/dashboard.css';
import './styles/features.css';
import './styles/dropdown.css';
import './styles/savings.css';
import { App } from './app.tsx';

createRoot(document.getElementById('root')!).render(<App />);
