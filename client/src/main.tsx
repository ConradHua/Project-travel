import React from 'react';
import { createRoot } from 'react-dom/client';
import { ProjectListPage } from './pages/ProjectListPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import './style.css';

const detailId = window.location.pathname.match(/^\/projects\/([^/]+)/)?.[1];
createRoot(document.getElementById('root')!).render(<React.StrictMode>{detailId ? <ProjectDetailPage id={detailId} /> : <ProjectListPage />}</React.StrictMode>);
