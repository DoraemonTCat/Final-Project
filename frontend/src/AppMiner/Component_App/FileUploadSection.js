// components/FileUploadSection.js
// =====================================================
// COMPONENT: FileUploadSection
// PURPOSE: อัพโหลดและอ่านไฟล์รายชื่อลูกค้า
// FEATURES:
// - รองรับไฟล์ Excel, Word, CSV
// - แสดง preview รายชื่อที่อ่านได้
// - เลือกผู้ใช้จากไฟล์เพื่อส่งข้อความ
// =====================================================

import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import * as mammoth from 'mammoth';

const FileUploadSection = ({ displayData, onSelectUsers, onClearSelection }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [usersFromFile, setUsersFromFile] = useState([]);
  const fileInputRef = useRef(null);

  // Read Excel file
  const readExcelFile = async (file) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      const userNames = [];
      jsonData.forEach(row => {
        const name = row['ชื่อ'] || row['Name'] || row['ชื่อผู้ใช้'] || row['Username'] || 
                    row['ชื่อ-นามสกุล'] || row['Full Name'] || row['ผู้ใช้'] || row['User'];
        if (name) {
          userNames.push(name.toString().trim());
        }
      });
      
      return [...new Set(userNames)];
    } catch (error) {
      console.error('Error reading Excel file:', error);
      throw new Error('ไม่สามารถอ่านไฟล์ Excel ได้');
    }
  };

  // Read Word file
  const readWordFile = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      const text = result.value;
      
      const lines = text.split('\n').filter(line => line.trim());
      const userNames = lines.map(line => line.trim());
      
      return [...new Set(userNames)];
    } catch (error) {
      console.error('Error reading Word file:', error);
      throw new Error('ไม่สามารถอ่านไฟล์ Word ได้');
    }
  };

  // Read CSV file
  const readCSVFile = async (file) => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        complete: (results) => {
          const userNames = [];
          results.data.forEach(row => {
            const name = row[0] || row['ชื่อ'] || row['Name'] || row['ชื่อผู้ใช้'];
            if (name && name.trim()) {
              userNames.push(name.trim());
            }
          });
          resolve([...new Set(userNames)]);
        },
        error: (error) => {
          reject(new Error('ไม่สามารถอ่านไฟล์ CSV ได้'));
        },
        header: true
      });
    });
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setUploadedFileName(file.name);

    try {
      let userNames = [];
      const fileType = file.name.split('.').pop().toLowerCase();

      switch (fileType) {
        case 'xlsx':
        case 'xls':
          userNames = await readExcelFile(file);
          break;
        case 'docx':
        case 'doc':
          userNames = await readWordFile(file);
          break;
        case 'csv':
          userNames = await readCSVFile(file);
          break;
        default:
          throw new Error('รองรับเฉพาะไฟล์ Excel (.xlsx, .xls), Word (.docx, .doc) และ CSV (.csv)');
      }

      if (userNames.length === 0) {
        throw new Error('ไม่พบรายชื่อในไฟล์');
      }

      setUsersFromFile(userNames);
      showSuccessNotification(`พบรายชื่อ ${userNames.length} คนในไฟล์`);
    } catch (error) {
      showErrorNotification(error.message);
      setUploadedFileName('');
      setUsersFromFile([]);
    } finally {
      setIsUploading(false);
    }
  };

  const selectUsersFromFile = () => {
    if (usersFromFile.length === 0) {
      showErrorNotification('กรุณาอัปโหลดไฟล์ที่มีรายชื่อก่อน');
      return;
    }

    // Find matching conversations
    const conversationsToSelect = displayData.filter(conv => {
      const userName = conv.user_name || conv.conversation_name || '';
      return usersFromFile.some(name => 
        userName.toLowerCase().includes(name.toLowerCase()) ||
        name.toLowerCase().includes(userName.toLowerCase())
      );
    });

    const conversationIds = conversationsToSelect.map(conv => conv.conversation_id);
    onSelectUsers(conversationIds);
    
    showSuccessNotification(`เลือกแล้ว ${conversationsToSelect.length} จาก ${usersFromFile.length} รายชื่อในไฟล์`);
  };

  const clearFile = () => {
    setUploadedFileName('');
    setUsersFromFile([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (onClearSelection) {
      onClearSelection();
    }
  };

  const showSuccessNotification = (message) => {
    const notification = document.createElement('div');
    notification.className = 'success-notification';
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-icon">✅</span>
        <span>${message}</span>
      </div>
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  };

  const showErrorNotification = (message) => {
    const notification = document.createElement('div');
    notification.className = 'error-notification';
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-icon">❌</span>
        <span>${message}</span>
      </div>
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  };

  return (
    <div className="file-upload-section">
      <div className="file-upload-container">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.doc,.docx,.csv"
          onChange={handleFileUpload}
          className="file-input"
          id="file-upload"
        />
        <label htmlFor="file-upload" className="file-upload-label">
          <span className="upload-icon">📁</span>
          <span>เลือกไฟล์รายชื่อ</span>
        </label>
        
        {uploadedFileName && (
          <div className="uploaded-file-info">
            <span className="file-name">{uploadedFileName}</span>
            <span className="user-count">({usersFromFile.length} รายชื่อ)</span>
            <button onClick={clearFile} className="clear-file-btn">✖</button>
          </div>
        )}
        
        <button
          onClick={selectUsersFromFile}
          disabled={usersFromFile.length === 0 || isUploading}
          className="select-from-file-btn"
        >
          <span className="btn-icon">✓</span>
          เลือกจากไฟล์
        </button>
        
        {isUploading && (
          <div className="upload-loading">
            <span className="loading-spinner"></span>
            <span>กำลังอ่านไฟล์...</span>
          </div>
        )}
      </div>
      
      {usersFromFile.length > 0 && (
        <div className="file-users-preview">
          <h4>รายชื่อในไฟล์:</h4>
          <div className="users-list">
            {usersFromFile.slice(0, 5).map((user, index) => (
              <span key={index} className="user-badge">{user}</span>
            ))}
            {usersFromFile.length > 5 && (
              <span className="more-users">...และอีก {usersFromFile.length - 5} คน</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUploadSection;