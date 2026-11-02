import React, { useState, useEffect } from 'react';
import { 
  Users, UserCheck, ShieldAlert, Download, UploadCloud, 
  Calendar, RotateCcw, Settings, FileSpreadsheet, X, MessageSquare, CheckCircle 
} from 'lucide-react';

export default function App() {
  const [students, setStudents] = useState([]);
  
  // App States
  const [activeTab, setActiveTab] = useState('inspection'); // 'inspection', 'stats'
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  
  // UI States
  const [uploadMessage, setUploadMessage] = useState({ type: '', text: '' });
  
  // Counseling Modal State
  const [modal, setModal] = useState({ isOpen: false, student: null, date: '', memo: '' });

  // --- Local Storage Sync ---
  useEffect(() => {
    const storedData = localStorage.getItem('uniform_inspector_data_v2');
    if (storedData) {
      try {
        const parsed = JSON.parse(storedData);
        parsed.sort((a, b) => {
          if (a.grade !== b.grade) return parseInt(a.grade) - parseInt(b.grade);
          if (a.classNumber !== b.classNumber) return parseInt(a.classNumber) - parseInt(b.classNumber);
          return parseInt(a.number) - parseInt(b.number);
        });
        setStudents(parsed);
      } catch (e) {
        console.error("Failed to parse local storage data", e);
      }
    }
  }, []);

  const saveToLocal = (newStudents) => {
    localStorage.setItem('uniform_inspector_data_v2', JSON.stringify(newStudents));
    setStudents(newStudents);
  };

  // --- Point Calculation Helper ---
  // Calculates current points dynamically: total - (counselingCount * 5)
  const getCurrentPoints = (totalPoints, counselings) => {
    const count = counselings ? counselings.length : 0;
    return Math.max(0, (totalPoints || 0) - (count * 5));
  };

  // --- Core Functions ---

  const handleToggle = (student, timeOfDay, part) => {
    const dateRecord = student.history?.[selectedDate] || {
      morningTop: false, morningBottom: false, afternoonTop: false, afternoonBottom: false, memo: ''
    };
    
    const fieldKey = `${timeOfDay}${part}`; 
    const currentValue = dateRecord[fieldKey] || false;
    const newValue = !currentValue;
    
    // Calculate point differences
    const pointDiff = newValue ? 0.5 : -0.5;
    const newTotalPoints = Math.max(0, (student.totalPoints || 0) + pointDiff);

    const updatedHistory = {
      ...student.history,
      [selectedDate]: {
        ...dateRecord,
        [fieldKey]: newValue
      }
    };

    const newStudents = students.map(s => 
      s.id === student.id 
        ? { ...s, history: updatedHistory, totalPoints: newTotalPoints } 
        : s
    );
    saveToLocal(newStudents);
  };

  const handleMemoChange = (student, text) => {
    const dateRecord = student.history?.[selectedDate] || {
      morningTop: false, morningBottom: false, afternoonTop: false, afternoonBottom: false, memo: ''
    };
    
    const updatedHistory = {
      ...student.history,
      [selectedDate]: { ...dateRecord, memo: text }
    };

    const newStudents = students.map(s => 
      s.id === student.id ? { ...s, history: updatedHistory } : s
    );
    saveToLocal(newStudents);
  };

  // --- Counseling Management ---
  const openCounselingModal = (student) => {
    setModal({
      isOpen: true,
      student: student,
      date: new Date().toISOString().split('T')[0],
      memo: ''
    });
  };

  const closeCounselingModal = () => {
    setModal({ isOpen: false, student: null, date: '', memo: '' });
  };

  const handleSaveCounseling = () => {
    if (!modal.student) return;

    const newCounselingRecord = {
      date: modal.date,
      memo: modal.memo,
      id: Date.now().toString()
    };

    const newStudents = students.map(s => {
      if (s.id === modal.student.id) {
        const updatedCounselings = [...(s.counselings || []), newCounselingRecord];
        return { ...s, counselings: updatedCounselings };
      }
      return s;
    });

    saveToLocal(newStudents);
    closeCounselingModal();
  };

  // --- CSV Upload/Export ---
  
  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadMessage({ type: 'info', text: '파일 처리 중입니다...' });

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
      if (lines.length < 2) {
        setUploadMessage({ type: 'error', text: '파일에 데이터가 충분하지 않습니다.' });
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim());
      const gIdx = headers.indexOf('학년');
      const cIdx = headers.indexOf('반');
      const numIdx = headers.indexOf('번호');
      const nameIdx = headers.indexOf('성명');

      if (gIdx === -1 || cIdx === -1 || numIdx === -1 || nameIdx === -1) {
        setUploadMessage({ type: 'error', text: 'CSV 열 제목이 올바르지 않습니다. (학년, 반, 번호, 성명 필수)' });
        return;
      }

      let count = 0;
      const updatedStudents = [...students];

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());
        if (cols.length < 4) continue;

        const grade = cols[gIdx];
        const classNumber = cols[cIdx];
        const number = cols[numIdx];
        const name = cols[nameIdx];
        
        if (!grade || !classNumber || !number || !name) continue;

        const docId = `${grade}-${classNumber}-${number}`;
        
        const existingIdx = updatedStudents.findIndex(s => s.id === docId);
        if (existingIdx >= 0) {
          updatedStudents[existingIdx] = { ...updatedStudents[existingIdx], name };
        } else {
          updatedStudents.push({
            id: docId,
            grade,
            classNumber,
            number,
            name,
            totalPoints: 0,
            counselings: [], // new counseling history array
            history: {}
          });
        }
        count++;
      }
      
      updatedStudents.sort((a, b) => {
        if (a.grade !== b.grade) return parseInt(a.grade) - parseInt(b.grade);
        if (a.classNumber !== b.classNumber) return parseInt(a.classNumber) - parseInt(b.classNumber);
        return parseInt(a.number) - parseInt(b.number);
      });

      saveToLocal(updatedStudents);
      setUploadMessage({ type: 'success', text: `총 ${count}명의 학생 데이터가 로컬에 반영 되었습니다.` });
      e.target.value = '';
    };
    reader.readAsText(file, 'utf-8'); 
  };

  const downloadCSV = () => {
    const headers = ['학년', '반', '번호', '성명', '현재 벌점', '총 누적 벌점', '상담 횟수'];
    const csvContent = [
      headers.join(','),
      ...students.map(s => {
        const curPts = getCurrentPoints(s.totalPoints, s.counselings);
        const counselCount = s.counselings ? s.counselings.length : 0;
        return [
          s.grade, 
          s.classNumber, 
          s.number, 
          s.name, 
          curPts, 
          s.totalPoints || 0, 
          counselCount
        ].join(',')
      })
    ].join('\n');

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' }); 
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `교복검사통계_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Components ---

  const CheckToggleButton = ({ active, onClick, label }) => (
    <button
      onClick={onClick}
      className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm flex-1 ${
        active 
          ? 'bg-red-500 text-white border border-red-600' 
          : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      {/* Top Navigation */}
      <nav className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="w-6 h-6 text-indigo-600" />
              <span className="font-bold text-lg text-indigo-900 tracking-tight">바른교복지킴이</span>
            </div>
            <div className="flex space-x-2 sm:space-x-4 items-center">
              <button 
                onClick={() => setActiveTab('inspection')}
                className={`p-2 sm:px-4 sm:py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${activeTab === 'inspection' ? 'text-indigo-600 bg-indigo-50 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <UserCheck className="w-5 h-5" />
                <span className="hidden sm:inline">일일 점검</span>
              </button>
              <button 
                onClick={() => setActiveTab('stats')}
                className={`p-2 sm:px-4 sm:py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${activeTab === 'stats' ? 'text-indigo-600 bg-indigo-50 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <FileSpreadsheet className="w-5 h-5" />
                <span className="hidden sm:inline">통계 및 상담 관리</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-2 sm:px-6 lg:px-8 py-6">
        
        {/* 1. INSPECTION TAB */}
        {activeTab === 'inspection' && (
          <div className="space-y-6">
            
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Calendar className="w-5 h-5 text-indigo-500" />
                <input 
                  type="date" 
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="border-gray-300 rounded-md shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 text-lg p-2 flex-grow sm:flex-grow-0 bg-gray-50"
                />
              </div>
              <div className="text-sm text-slate-500 w-full sm:w-auto text-right">
                오늘의 점검 내역을 기록하세요.
              </div>
            </div>

            {students.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">등록된 학생이 없습니다.</p>
                <p className="text-sm text-gray-400">통계 및 관리 탭에서 학생 명단(CSV)을 업로드 해주세요.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {students.map(student => {
                  const todayRecord = student.history?.[selectedDate] || {};
                  const currentPts = getCurrentPoints(student.totalPoints, student.counselings);
                  const isDanger = currentPts >= 5;

                  return (
                    <div key={student.id} className={`bg-white rounded-xl shadow-sm border p-4 flex flex-col transition-all ${isDanger ? 'border-red-400 shadow-red-100 ring-1 ring-red-400' : 'border-slate-200'}`}>
                          
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${isDanger ? 'bg-red-100 text-red-800' : 'bg-indigo-100 text-indigo-800'}`}>
                                {student.number}
                              </div>
                              <div>
                                <h3 className="font-bold text-lg text-slate-800">{student.name}</h3>
                                <p className="text-xs text-slate-500">{student.grade}학년 {student.classNumber}반</p>
                              </div>
                            </div>
                            
                            <div className="text-right flex flex-col items-end">
                              <div className="text-sm font-medium text-slate-500">현재: <span className={`font-bold text-lg ${isDanger ? 'text-red-600' : 'text-indigo-600'}`}>{currentPts}점</span></div>
                              <div className="text-xs text-slate-400">총 누적: {student.totalPoints || 0}점</div>
                            </div>
                          </div>

                          {isDanger && (
                            <div className="mb-4 flex items-center justify-center bg-red-50 text-red-700 px-3 py-2 rounded-lg text-sm border border-red-200 font-bold">
                              <ShieldAlert className="w-4 h-4 mr-2" /> 상담 필요 (5점 이상)
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-3 mb-4 mt-auto">
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                              <div className="text-xs font-bold text-slate-500 mb-2 flex items-center justify-center">🌅 조회 체크</div>
                              <div className="flex flex-col gap-2">
                                <CheckToggleButton active={todayRecord.morningTop} onClick={() => handleToggle(student, 'morning', 'Top')} label="상의 불량" />
                                <CheckToggleButton active={todayRecord.morningBottom} onClick={() => handleToggle(student, 'morning', 'Bottom')} label="하의 불량" />
                              </div>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                              <div className="text-xs font-bold text-slate-500 mb-2 flex items-center justify-center">🌇 종례 체크</div>
                              <div className="flex flex-col gap-2">
                                <CheckToggleButton active={todayRecord.afternoonTop} onClick={() => handleToggle(student, 'afternoon', 'Top')} label="상의 불량" />
                                <CheckToggleButton active={todayRecord.afternoonBottom} onClick={() => handleToggle(student, 'afternoon', 'Bottom')} label="하의 불량" />
                              </div>
                            </div>
                          </div>

                          <div>
                            <input
                              type="text"
                              placeholder="특이사항 메모 (예: 체육복 등교)"
                              value={todayRecord.memo || ''}
                              onChange={(e) => handleMemoChange(student, e.target.value)}
                              className="w-full text-sm border-gray-200 rounded-md shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 p-2 bg-gray-50"
                            />
                          </div>

                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 2. STATS & ADMIN TAB */}
            {activeTab === 'stats' && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-4 sm:p-6 border-b flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50">
                    <div>
                      <h2 className="text-xl font-bold text-slate-800">학생 벌점 및 상담 현황</h2>
                      <p className="text-sm text-slate-500 mt-1">5점 이상인 학생과 상담을 진행하고 기록을 남기세요.</p>
                    </div>
                    <button 
                      onClick={downloadCSV}
                      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors w-full sm:w-auto justify-center"
                    >
                      <Download className="w-5 h-5" /> CSV 다운로드
                    </button>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                      <thead>
                        <tr className="bg-white text-slate-600 text-sm border-b">
                          <th className="p-4 font-semibold w-16 text-center">번호</th>
                          <th className="p-4 font-semibold">성명</th>
                          <th className="p-4 font-semibold text-center">현재 벌점</th>
                          <th className="p-4 font-semibold text-center text-slate-400">총 누적</th>
                          <th className="p-4 font-semibold">상담 상태 및 관리</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map(s => {
                          const currentPts = getCurrentPoints(s.totalPoints, s.counselings);
                          const isDanger = currentPts >= 5;
                          const counselCount = s.counselings ? s.counselings.length : 0;
                          
                          return (
                            <tr key={s.id} className={`border-b transition-colors ${isDanger ? 'bg-red-50/30' : 'hover:bg-slate-50'}`}>
                              <td className="p-4 text-sm font-medium text-slate-800 text-center">{s.number}</td>
                              <td className="p-4 font-semibold text-slate-900">{s.name}</td>
                              <td className="p-4 text-center">
                                <span className={`font-bold text-lg ${isDanger ? 'text-red-600' : 'text-indigo-600'}`}>
                                  {currentPts}
                                </span>
                              </td>
                              <td className="p-4 text-sm text-slate-400 text-center">{s.totalPoints || 0}</td>
                              <td className={`p-4 ${isDanger ? 'bg-red-50' : ''}`}>
                                {isDanger ? (
                                  <div className="flex items-center gap-3">
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                                      상담 필요
                                    </span>
                                    <button
                                      onClick={() => openCounselingModal(s)}
                                      className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-md font-medium transition-colors shadow-sm"
                                    >
                                      상담 관리
                                    </button>
                                  </div>
                                ) : (
                                  <div className="text-sm text-slate-500">
                                    {counselCount > 0 ? (
                                      <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                                        <CheckCircle className="w-4 h-4" /> {counselCount}회 완료
                                      </span>
                                    ) : (
                                      "해당 없음"
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                        {students.length === 0 && (
                          <tr>
                            <td colSpan="5" className="p-8 text-center text-slate-500">데이터가 없습니다. 아래에서 명단을 업로드해주세요.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* CSV Upload Area */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                      <UploadCloud className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800">학생 명단 새로고침 (CSV 업로드)</h3>
                      <p className="text-xs text-slate-500">첫 줄은 '학년, 반, 번호, 성명' 형태여야 합니다.</p>
                    </div>
                  </div>

                  <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center hover:bg-slate-50 transition-colors">
                    <input 
                      type="file" 
                      accept=".csv"
                      onChange={handleCSVUpload}
                      className="block w-full text-sm text-slate-500
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-full file:border-0
                        file:text-sm file:font-semibold
                        file:bg-indigo-50 file:text-indigo-700
                        hover:file:bg-indigo-100
                        cursor-pointer mx-auto max-w-sm"
                    />
                  </div>

                  {uploadMessage.text && (
                    <div className={`mt-4 p-3 rounded-lg text-sm font-medium ${
                      uploadMessage.type === 'error' ? 'bg-red-50 text-red-600 border border-red-200' :
                      uploadMessage.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' :
                      'bg-blue-50 text-blue-600 border border-blue-200'
                    }`}>
                      {uploadMessage.text}
                    </div>
                  )}
                </div>
              </div>
            )}
      </main>

      {/* Counseling Modal */}
      {modal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all">
            <div className="flex justify-between items-center p-5 border-b">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-indigo-600" />
                학급 상담 기록
              </h3>
              <button onClick={closeCounselingModal} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100 flex items-center justify-between">
                <span className="font-semibold text-indigo-900">{modal.student?.name} 학생</span>
                <span className="text-sm text-indigo-700">현재 벌점: {getCurrentPoints(modal.student?.totalPoints, modal.student?.counselings)}점</span>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">상담 완료 날짜</label>
                <input 
                  type="date" 
                  value={modal.date}
                  onChange={(e) => setModal({ ...modal, date: e.target.value })}
                  className="w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2.5 bg-slate-50 border"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">상담 메모 (선택)</label>
                <textarea 
                  rows="3"
                  placeholder="상담 내용이나 특이사항을 간단히 기록하세요."
                  value={modal.memo}
                  onChange={(e) => setModal({ ...modal, memo: e.target.value })}
                  className="w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2.5 bg-slate-50 border resize-none"
                />
              </div>
            </div>

            <div className="p-4 border-t bg-slate-50 flex justify-end gap-2">
              <button 
                onClick={closeCounselingModal}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                취소
              </button>
              <button 
                onClick={handleSaveCounseling}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-lg hover:bg-indigo-700 shadow-sm"
              >
                상담 완료 및 저장 (5점 차감)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}