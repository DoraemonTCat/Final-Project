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

const FileUploadSection = ({ 
  displayData, 
  onSelectUsers, 
  onClearSelection,
  selectedPage,
  onAddUsersFromFile // 🆕 Callback สำหรับเพิ่ม users จาก database
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [usersFromFile, setUsersFromFile] = useState([]);
  const [searchStats, setSearchStats] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const fileInputRef = useRef(null);

  // อ่านไฟล์ Excel
  const readExcelFile = async (file) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      const userNames = [];
      jsonData.forEach(row => {
        const name = row['ชื่อ'] || row['Name'] || row['ชื่อผู้ใช้'] || 
                    row['Username'] || row['ชื่อ-นามสกุล'] || 
                    row['Full Name'] || row['ผู้ใช้'] || row['User'];
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

  // อ่านไฟล์ Word
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

  // อ่านไฟล์ CSV
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

  // 🆕 ค้นหาใน database
  const searchInDatabase = async (userNames) => {
    if (!selectedPage || userNames.length === 0) return;
    
    setIsSearching(true);
    try {
      const response = await fetch('http://localhost:8000/search-customers-by-file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          page_id: selectedPage,
          user_names: userNames
        })
      });

      if (!response.ok) {
        throw new Error('ค้นหาข้อมูลไม่สำเร็จ');
      }

      const data = await response.json();
      
      setSearchStats({
        found: data.found_count,
        notFound: data.not_found_count,
        notFoundNames: data.not_found_names || []
      });

      if (data.found_count > 0) {
        // เรียก callback เพื่อเพิ่ม users ที่พบเข้าไปในตาราง
        if (onAddUsersFromFile) {
          onAddUsersFromFile(data.customers);
        }
        
        // เลือก users ที่พบอัตโนมัติ
        const conversationIds = data.customers.map(c => c.conversation_id);
        onSelectUsers(conversationIds);
        
        showSuccessNotification(
          `พบข้อมูลในระบบ ${data.found_count} คน จากทั้งหมด ${userNames.length} คน`
        );
      } else {
        showWarningNotification('ไม่พบข้อมูลที่ตรงกันในระบบ');
      }
      
    } catch (error) {
      console.error('Error searching in database:', error);
      showErrorNotification('เกิดข้อผิดพลาดในการค้นหาข้อมูล');
    } finally {
      setIsSearching(false);
    }
  };

  // จัดการอัพโหลดไฟล์
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setUploadedFileName(file.name);
    setSearchStats(null);

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
          throw new Error('รองรับเฉพาะไฟล์ Excel, Word และ CSV');
      }

      if (userNames.length === 0) {
        throw new Error('ไม่พบรายชื่อในไฟล์');
      }

      setUsersFromFile(userNames);
      showSuccessNotification(`พบรายชื่อ ${userNames.length} คนในไฟล์`);
      
      // 🆕 ค้นหาใน database อัตโนมัติ
      await searchInDatabase(userNames);
      
    } catch (error) {
      showErrorNotification(error.message);
      setUploadedFileName('');
      setUsersFromFile([]);
    } finally {
      setIsUploading(false);
    }
  };

  // ฟังก์ชัน Notification
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

  const showWarningNotification = (message) => {
    const notification = document.createElement('div');
    notification.className = 'warning-notification';
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-icon">⚠️</span>
        <span>${message}</span>
      </div>
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  };

  const clearFile = () => {
    setUploadedFileName('');
    setUsersFromFile([]);
    setSearchStats(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (onClearSelection) {
      onClearSelection();
    }
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
          disabled={!selectedPage}
        />
        <label 
          htmlFor="file-upload" 
          className={`file-upload-label ${!selectedPage ? 'disabled' : ''}`}
        >
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
        
        {isSearching && (
          <div className="search-loading">
            <span className="loading-spinner"></span>
            <span>กำลังค้นหาในระบบ...</span>
          </div>
        )}
        
        {isUploading && (
          <div className="upload-loading">
            <span className="loading-spinner"></span>
            <span>กำลังอ่านไฟล์...</span>
          </div>
        )}
      </div>
      
    </div>
  );
};

export default FileUploadSection;