import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './AppMiner/App';
import GroupDefault from './AppMiner/GroupDefault';
import Default from './AppMiner/Default';
import MinerGroup from './AppMiner/MinerGroup';
import ManageMessageSets from './AppMiner/ManageMessageSets';
import reportWebVitals from './reportWebVitals';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import GroupSchedule from './AppMiner/GroupSchedule';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/GroupDefault" element={<GroupDefault />} />
        <Route path="/App" element={<App />} />
        <Route path="/Default" element={<Default />} />
        <Route path="/MinerGroup" element={<MinerGroup />} />
        <Route path="/manage-message-sets" element={<ManageMessageSets />} />
        <Route path="/GroupSchedule" element={<GroupSchedule />} />
        {/* Add more routes as needed */}

      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);

reportWebVitals();