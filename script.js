// script.js - HSC 26 চ্যালেঞ্জ (রিমাইন্ডার + অগ্রগতি ফিক্স)

// ==================== গ্লোবাল ভেরিয়েবল ====================
let fullData = null;
let currentDayIndex = 0;
let timerInterval = null;
let countdownInterval = null;
let activeTimer = null;
let timerSeconds = 1500;
let timerRunning = false;
let pomodoroCount = 0;
let currentFontSize = 100;
let darkMode = false;
let userProgress = {};
let reviews = {};

// ==================== ডাটা লোড ====================
async function loadData() {
  try {
    console.log('📥 ডাটা লোড শুরু...');
    
    const response = await fetch('data.json?t=' + Date.now());
    if (!response.ok) throw new Error('JSON ফাইল পাওয়া যায়নি');
    
    fullData = await response.json();
    console.log('✅ ডাটা লোড সফল:', fullData.days.length, 'দিন');
    
    if (!fullData?.days?.length) throw new Error('ডাটা খালি');
    
    normalizeData();
    loadProgress();
    loadReviews();
    updateCurrentDayByTime();
    renderAll();
    startCountdown();
    
    // রিমাইন্ডার চেক শুরু করুন
    startReminderChecker();
    
  } catch (error) {
    console.error('❌ ডাটা লোড সমস্যা:', error);
    createFallbackData();
  }
}

// ==================== রিমাইন্ডার সিস্টেম ====================

// রিমাইন্ডার চেকার শুরু
function startReminderChecker() {
  console.log('🔔 রিমাইন্ডার চেকার শুরু...');
  
  // প্রতি মিনিটে চেক করুন
  setInterval(() => {
    checkReminders();
  }, 60000); // 60 সেকেন্ড
  
  // প্রথমবার ৫ সেকেন্ড পর চেক করুন
  setTimeout(() => {
    checkReminders();
  }, 5000);
}

// রিমাইন্ডার চেক
function checkReminders() {
  if (!fullData?.days?.[currentDayIndex]) return;
  
  const now = new Date();
  const nowTime = now.getHours() * 60 + now.getMinutes();
  const nowTimeStr = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
  
  const today = fullData.days[currentDayIndex];
  
  // আগামী ১৫ মিনিটের মধ্যে যে সেশনগুলো শুরু হবে
  let upcomingSessions = [];
  
  today.slots.forEach((slot, index) => {
    const [start] = parseTimeRange(slot.time);
    const timeDiff = start - nowTime;
    
    // ১৫ মিনিটের মধ্যে এবং ইতিমধ্যে নোটিফাই করিনি
    if (timeDiff > 0 && timeDiff <= 15 && !userProgress[`reminded_${currentDayIndex}_${index}`]) {
      upcomingSessions.push({
        slot: slot,
        minutesLeft: timeDiff,
        index: index
      });
    }
  });
  
  // রিমাইন্ডার দেখান
  upcomingSessions.forEach(session => {
    showReminder(session.slot, session.minutesLeft);
    // রিমাইন্ডার পাঠানো হয়েছে মার্ক করুন
    userProgress[`reminded_${currentDayIndex}_${session.index}`] = true;
  });
  
  saveProgress();
}

// রিমাইন্ডার দেখান
function showReminder(slot, minutesLeft) {
  const message = `🔔 ${slot.activity} শুরু হতে ${minutesLeft} মিনিট বাকি!`;
  
  console.log(message);
  
  // ব্রাউজার নোটিফিকেশন
  if (Notification.permission === 'granted') {
    new Notification('HSC 26 চ্যালেঞ্জ', {
      body: message,
      icon: 'https://via.placeholder.com/48/0066ff/ffffff?text=HSC'
    });
  }
  
  // স্ক্রিনে টোস্ট দেখান
  showToast(message, 'reminder');
}

// ম্যানুয়াল রিমাইন্ডার সেট
window.setReminder = function() {
  if (!fullData?.days?.[currentDayIndex]) {
    alert('ডাটা লোড হয়নি');
    return;
  }
  
  const now = new Date();
  const nowTime = now.getHours() * 60 + now.getMinutes();
  const today = fullData.days[currentDayIndex];
  
  // পরবর্তী সেশন খুঁজুন
  let nextSession = null;
  let minDiff = Infinity;
  
  today.slots.forEach(slot => {
    const [start] = parseTimeRange(slot.time);
    const diff = start - nowTime;
    if (diff > 0 && diff < minDiff) {
      minDiff = diff;
      nextSession = slot;
    }
  });
  
  if (nextSession) {
    const mins = minDiff;
    const hours = Math.floor(mins / 60);
    const minutes = mins % 60;
    
    let timeText = '';
    if (hours > 0) {
      timeText = `${hours} ঘন্টা ${minutes} মিনিট`;
    } else {
      timeText = `${minutes} মিনিট`;
    }
    
    showToast(`🔔 পরবর্তী সেশন: ${nextSession.activity} (${timeText} বাকি)`, 'reminder');
    
    // নোটিফিকেশন পারমিশন চেক
    if (Notification.permission === 'granted') {
      new Notification('রিমাইন্ডার সেট করা হয়েছে', {
        body: `${nextSession.activity} শুরু হবে ${timeText} পর`,
        icon: 'https://via.placeholder.com/48/0066ff/ffffff?text=HSC'
      });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
    
    // কাস্টম রিমাইন্ডার সেট করুন (৫ মিনিট পর)
    setTimeout(() => {
      showToast(`🔔 ${nextSession.activity} শুরু হতে ৫ মিনিট বাকি!`, 'reminder');
      if (Notification.permission === 'granted') {
        new Notification('রিমাইন্ডার!', {
          body: `${nextSession.activity} শুরু হতে ৫ মিনিট বাকি`,
          icon: 'https://via.placeholder.com/48/ff9900/ffffff?text=HSC'
        });
      }
    }, (minDiff - 5) * 60 * 1000);
    
  } else {
    showToast('আজকের জন্য কোনো পরবর্তী সেশন নেই', 'info');
  }
};

// টোস্ট দেখান
function showToast(message, type = 'info') {
  // পুরনো টোস্ট সরান
  const oldToast = document.querySelector('.custom-toast');
  if (oldToast) oldToast.remove();
  
  // নতুন টোস্ট তৈরি
  const toast = document.createElement('div');
  toast.className = 'custom-toast';
  
  // টাইপ অনুযায়ী রঙ
  let bgColor = '#0066ff';
  if (type === 'reminder') bgColor = '#ff9900';
  else if (type === 'success') bgColor = '#00cc66';
  else if (type === 'error') bgColor = '#ff4444';
  
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${bgColor};
    color: white;
    padding: 15px 25px;
    border-radius: 50px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    z-index: 9999;
    animation: slideInRight 0.3s, fadeOut 0.3s 2.7s;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 10px;
    max-width: 300px;
  `;
  
  // আইকন যোগ
  let icon = 'fa-info-circle';
  if (type === 'reminder') icon = 'fa-bell';
  else if (type === 'success') icon = 'fa-check-circle';
  else if (type === 'error') icon = 'fa-exclamation-circle';
  
  toast.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
  
  document.body.appendChild(toast);
  
  // ৩ সেকেন্ড পর সরান
  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, 3000);
}

// অ্যানিমেশন যোগ করুন
const style = document.createElement('style');
style.innerHTML = `
  @keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes fadeOut {
    from { opacity: 1; }
    to { opacity: 0; }
  }
`;
document.head.appendChild(style);

// ==================== আজকের অগ্রগতি আপডেট ====================
function updateDailyProgress(slots) {
  try {
    let completed = 0;
    let totalDuration = 0;
    let completedDuration = 0;
    
    slots.forEach((slot, i) => {
      const duration = slot.duration || 30;
      totalDuration += duration;
      
      if (userProgress[`slot_${currentDayIndex}_${i}`]) {
        completed++;
        completedDuration += duration;
      }
    });
    
    // পার্সেন্টেজ (স্লট সংখ্যা অনুযায়ী)
    const slotPercent = slots.length ? Math.round((completed / slots.length) * 100) : 0;
    
    // সময় অনুযায়ী পার্সেন্টেজ
    const timePercent = totalDuration ? Math.round((completedDuration / totalDuration) * 100) : 0;
    
    // আপডেট করুন (স্লট সংখ্যা দেখানো ভালো)
    updateElement('dailyProgressPercent', `${slotPercent}%`);
    
    const bar = document.getElementById('dailyProgressBar');
    if (bar) {
      bar.style.width = slotPercent + '%';
      
      // পার্সেন্টেজ অনুযায়ী রঙ পরিবর্তন
      if (slotPercent >= 80) {
        bar.style.background = 'linear-gradient(90deg, #00cc66, #0066ff)';
      } else if (slotPercent >= 50) {
        bar.style.background = 'linear-gradient(90deg, #ff9900, #0066ff)';
      } else {
        bar.style.background = 'linear-gradient(90deg, #0066ff, #00cc66)';
      }
    }
    
    // টুলটিপ আপডেট
    const progressLabel = document.querySelector('.progress-label span:first-child');
    if (progressLabel) {
      progressLabel.innerHTML = `আজকের অগ্রগতি (${completed}/${slots.length} সেশন)`;
    }
    
    // ১০০% হলে ক্রাউন
    if (slotPercent === 100) {
      updateElement('dailyBadge', '<i class="fas fa-crown" style="color: #FFD700;"></i>');
      updateStreak(true);
      
      // সাকসেস মেসেজ
      showToast('🎉 অভিনন্দন! আজকের সব সেশন শেষ!', 'success');
    } else {
      updateElement('dailyBadge', '<i class="fas fa-medal"></i>');
    }
    
    console.log(`📊 অগ্রগতি: ${completed}/${slots.length} (${slotPercent}%)`);
    
  } catch (e) {
    console.warn('প্রগ্রেস আপডেট সমস্যা:', e);
  }
}

// ==================== ডাটা নরমালাইজ ====================
function normalizeData() {
  console.log('🔄 ডাটা নরমালাইজ করা হচ্ছে...');
  
  fullData.days.forEach((day, dayIndex) => {
    day.slots.forEach((slot, slotIndex) => {
      if (!slot.activity) {
        if (slot.subject) {
          slot.activity = slot.subject;
        } else {
          slot.activity = 'পড়াশোনা';
        }
      }
      
      if (!slot.detail) {
        slot.detail = slot.activity || 'পড়াশোনা';
      }
      
      if (!slot.type) {
        if (slot.subject?.includes('ICT')) slot.type = 'ict';
        else if (slot.subject?.includes('বাংলা')) slot.type = 'bangla';
        else slot.type = 'routine';
      }
      
      if (!slot.duration || slot.duration <= 0) {
        slot.duration = 30;
      }
    });
  });
  
  console.log('✅ ডাটা নরমালাইজ সম্পন্ন');
}

// ==================== ডেমো ডাটা ====================
function createFallbackData() {
  console.log('📊 ডেমো ডাটা তৈরি...');
  
  fullData = { days: [] };
  
  for (let i = 1; i <= 11; i++) {
    const slots = [
      {"time": "05:00-05:30", "activity": "ঘুম থেকে ওঠো", "detail": "সেহরি খাও", "duration": 30, "type": "routine"},
      {"time": "05:30-06:00", "activity": "ফজর পড়ো", "detail": "তাহাজ্জুদ + ফজর", "duration": 30, "type": "prayer"},
      {"time": "06:00-07:30", "activity": `ICT অধ্যায় ${i}`, "detail": "পড়াশোনা", "duration": 90, "type": "ict"},
      {"time": "07:30-08:00", "activity": "বাংলা পদ্য", "detail": "পড়াশোনা", "duration": 30, "type": "poem"},
      {"time": "22:00-05:00", "activity": "ঘুম", "detail": "৭ ঘণ্টা", "duration": 420, "type": "sleep"}
    ];
    
    fullData.days.push({
      day: i,
      date: `${22 + i} ফেব্রুয়ারি ২০২৬`,
      slots: slots
    });
  }
  
  loadProgress();
  loadReviews();
  updateCurrentDayByTime();
  renderAll();
  startCountdown();
  startReminderChecker();
}

// ==================== রিভিউ সিস্টেম ====================
function loadReviews() {
  try {
    const saved = localStorage.getItem('hsc26_reviews');
    if (saved) reviews = JSON.parse(saved);
  } catch (e) {}
}

function saveReviews() {
  try {
    localStorage.setItem('hsc26_reviews', JSON.stringify(reviews));
  } catch (e) {}
}

window.setRating = function(stars) {
  for (let i = 1; i <= 5; i++) {
    const star = document.querySelector(`.rating-stars i:nth-child(${i})`);
    if (star) star.className = i <= stars ? 'fas fa-star' : 'far fa-star';
  }
  
  const dayKey = `day_${currentDayIndex + 1}`;
  if (!reviews[dayKey]) reviews[dayKey] = { rating: 0, review: '', date: fullData.days[currentDayIndex].date };
  reviews[dayKey].rating = stars;
  
  saveReviews();
  showAllReviews();
};

window.saveReview = function() {
  const reviewText = document.getElementById('reviewText');
  if (!reviewText) return;
  
  const dayKey = `day_${currentDayIndex + 1}`;
  if (!reviews[dayKey]) reviews[dayKey] = { rating: 0, review: '', date: fullData.days[currentDayIndex].date };
  reviews[dayKey].review = reviewText.value;
  reviews[dayKey].date = fullData.days[currentDayIndex].date;
  
  saveReviews();
  showAllReviews();
  reviewText.value = '';
  showToast('✅ রিভিউ সেভ হয়েছে', 'success');
};

function showAllReviews() {
  const container = document.getElementById('allReviewsContainer');
  if (!container) return;
  
  if (Object.keys(reviews).length === 0) {
    container.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">কোনো রিভিউ নেই</div>';
    return;
  }
  
  let html = '<div class="reviews-list">';
  
  const sortedDays = Object.keys(reviews).sort((a, b) => {
    const dayA = parseInt(a.split('_')[1]);
    const dayB = parseInt(b.split('_')[1]);
    return dayB - dayA;
  });
  
  sortedDays.forEach(dayKey => {
    const review = reviews[dayKey];
    const dayNum = dayKey.split('_')[1];
    
    html += `
      <div class="review-item" style="background: #1e2537; padding: 15px; margin: 10px 0; border-radius: 10px; border-left: 4px solid #ff9900;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="font-weight: 600; color: #0066ff;">দিন ${dayNum}</span>
          <span style="color: #8892b0; font-size: 0.85rem;">${review.date || ''}</span>
        </div>
        <div style="margin-bottom: 8px;">
          ${getStarHTML(review.rating || 0)}
        </div>
        <div style="color: #e0e0e0;">${review.review || 'কোনো মন্তব্য নেই'}</div>
      </div>
    `;
  });
  
  html += '</div>';
  container.innerHTML = html;
}

function getStarHTML(rating) {
  let stars = '';
  for (let i = 1; i <= 5; i++) {
    stars += i <= rating ? 
      '<i class="fas fa-star" style="color: #ff9900;"></i>' : 
      '<i class="far fa-star" style="color: #ff9900;"></i>';
  }
  return stars;
}

function loadCurrentDayReview() {
  const dayKey = `day_${currentDayIndex + 1}`;
  const review = reviews[dayKey];
  
  if (review && review.rating) {
    for (let i = 1; i <= 5; i++) {
      const star = document.querySelector(`.rating-stars i:nth-child(${i})`);
      if (star) star.className = i <= review.rating ? 'fas fa-star' : 'far fa-star';
    }
  } else {
    for (let i = 1; i <= 5; i++) {
      const star = document.querySelector(`.rating-stars i:nth-child(${i})`);
      if (star) star.className = 'far fa-star';
    }
  }
  
  const reviewText = document.getElementById('reviewText');
  if (reviewText) reviewText.value = review ? review.review || '' : '';
}

// ==================== রেন্ডার ====================
function renderAll() {
  if (!fullData?.days?.[currentDayIndex]) return;
  
  const today = fullData.days[currentDayIndex];
  console.log(`🎨 রেন্ডার করছি: দিন ${today.day}`);
  
  updateElement('dayIndicator', `দিন ${today.day}`);
  updateElement('selectedDateLabel', today.date);
  updateElement('todayDateBadge', today.date);
  updateElement('currentDayNum', today.day);
  
  try {
    renderSlotsTable(today.slots);
    updateDailyProgress(today.slots);
    updateTimeAnalysis(today.slots);
    renderHeatmap();
    updateStreak();
    loadCurrentDayReview();
    showAllReviews();
  } catch (e) {
    console.error('রেন্ডার সমস্যা:', e);
  }
}

// ==================== স্লট টেবিল ====================
function renderSlotsTable(slots) {
  const container = document.getElementById('slotsTable');
  if (!container) return;
  
  const now = new Date();
  const nowTime = now.getHours() * 60 + now.getMinutes();
  
  let html = '';
  
  slots.forEach((slot, index) => {
    try {
      const [start, end] = parseTimeRange(slot.time);
      
      let isOverdue = false;
      if (start > end) {
        isOverdue = (nowTime > end && nowTime < start) && !userProgress[`slot_${currentDayIndex}_${index}`];
      } else {
        isOverdue = end < nowTime && !userProgress[`slot_${currentDayIndex}_${index}`];
      }
      
      const isCompleted = userProgress[`slot_${currentDayIndex}_${index}`];
      
      let icon = 'fa-clock';
      const type = slot.type || '';
      if (type.includes('ict')) icon = 'fa-microchip';
      else if (type.includes('prayer')) icon = 'fa-mosque';
      else if (type.includes('poem')) icon = 'fa-feather';
      else if (type.includes('prose')) icon = 'fa-book-open';
      else if (type.includes('grammar')) icon = 'fa-spell-check';
      else if (type.includes('sleep')) icon = 'fa-bed';
      
      const activity = slot.activity || 'পড়াশোনা';
      const detail = slot.detail || activity;
      const duration = slot.duration || 30;
      
      html += `
        <div class="table-row ${isOverdue ? 'overdue' : ''} ${isCompleted ? 'completed' : ''}" 
             onclick="openTimer('${activity.replace(/'/g, "\\'")}', ${duration})">
          <div class="checkbox-wrapper" onclick="event.stopPropagation()">
            <input type="checkbox" class="task-checkbox" 
              onchange="markTaskComplete(${currentDayIndex}, ${index}, this.checked)"
              ${isCompleted ? 'checked' : ''}>
          </div>
          <span class="time-badge">${slot.time}</span>
          <div class="activity-icon"><i class="fas ${icon}"></i></div>
          <div class="activity-detail">
            ${activity} <small>${detail}</small>
          </div>
          <span class="duration">${duration} min</span>
        </div>
      `;
    } catch (e) {
      console.warn('স্লট রেন্ডার সমস্যা:', e);
    }
  });
  
  container.innerHTML = html;
}

function updateTimeAnalysis(slots) {
  try {
    let ict = 0, bangla = 0;
    slots.forEach(s => {
      const type = s.type || '';
      if (type.includes('ict')) ict += s.duration || 30;
      else if (type.includes('poem') || type.includes('prose') || type.includes('grammar')) bangla += s.duration || 30;
    });
    
    const total = ict + bangla;
    const ictBar = document.getElementById('ictBar');
    const banglaBar = document.getElementById('banglaBar');
    
    if (ictBar) ictBar.style.width = total ? (ict / total) * 100 + '%' : '0%';
    if (banglaBar) banglaBar.style.width = total ? (bangla / total) * 100 + '%' : '0%';
    
    updateElement('ictTime', ict + ' মিনিট');
    updateElement('banglaTime', bangla + ' মিনিট');
  } catch (e) {
    console.warn('টাইম অ্যানালাইসিস সমস্যা:', e);
  }
}

function renderHeatmap() {
  const grid = document.getElementById('heatmapGrid');
  if (!grid || !fullData?.days) return;
  
  try {
    let html = '';
    for (let i = 0; i < 7; i++) {
      const idx = currentDayIndex - 6 + i;
      if (idx >= 0 && idx < fullData.days.length) {
        const day = fullData.days[idx];
        let completed = 0;
        day.slots.forEach((_, si) => {
          if (userProgress[`slot_${idx}_${si}`]) completed++;
        });
        const level = Math.min(4, Math.floor((completed / day.slots.length) * 5));
        html += `<div class="heatmap-cell completed-${level}" title="দিন ${day.day}: ${completed}/${day.slots.length}">${day.day}</div>`;
      } else {
        html += '<div class="heatmap-cell completed-0">-</div>';
      }
    }
    grid.innerHTML = html;
  } catch (e) {
    console.warn('হিটম্যাপ রেন্ডার সমস্যা:', e);
  }
}

// ==================== টাস্ক কমপ্লিশন ====================
function markTaskComplete(dayIndex, slotIndex, checked) {
  try {
    const key = `slot_${dayIndex}_${slotIndex}`;
    if (checked) userProgress[key] = true;
    else delete userProgress[key];
    
    saveProgress();
    
    if (dayIndex === currentDayIndex && fullData?.days?.[currentDayIndex]) {
      updateDailyProgress(fullData.days[currentDayIndex].slots);
      renderHeatmap();
      
      if (checked) {
        showToast(`✅ ${fullData.days[currentDayIndex].slots[slotIndex].activity} শেষ!`, 'success');
      }
    }
  } catch (e) {
    console.warn('টাস্ক মার্ক সমস্যা:', e);
  }
}

// ==================== স্ট্রিক ====================
function updateStreak(increment = false) {
  try {
    let streak = parseInt(localStorage.getItem('hsc26_streak') || '0');
    if (increment) {
      streak++;
      localStorage.setItem('hsc26_streak', streak);
      showToast(`🔥 ${streak} দিনের স্ট্রিক!`, 'success');
    }
    updateElement('streakCount', streak);
  } catch (e) {
    console.warn('স্ট্রিক আপডেট সমস্যা:', e);
  }
}

// ==================== টাইমার ফাংশন ====================
window.openTimer = function(activity, duration) {
  const modal = document.getElementById('timerModal');
  if (!modal) return;
  updateElement('currentSessionName', activity || 'পড়াশোনা');
  timerSeconds = (duration || 30) * 60;
  updateTimerDisplay();
  modal.style.display = 'flex';
};

window.closeTimer = function() {
  const modal = document.getElementById('timerModal');
  if (modal) modal.style.display = 'none';
  if (activeTimer) clearInterval(activeTimer);
  timerRunning = false;
};

window.startTimer = function() {
  if (timerRunning) return;
  timerRunning = true;
  activeTimer = setInterval(() => {
    if (timerSeconds > 0) {
      timerSeconds--;
      updateTimerDisplay();
    } else {
      clearInterval(activeTimer);
      timerRunning = false;
      pomodoroCount++;
      updateElement('pomodoroCount', pomodoroCount);
      showToast('⏰ সেশন শেষ!', 'reminder');
    }
  }, 1000);
};

window.pauseTimer = function() {
  if (activeTimer) clearInterval(activeTimer);
  timerRunning = false;
};

window.resetTimer = function() {
  pauseTimer();
  timerSeconds = 1500;
  updateTimerDisplay();
};

function updateTimerDisplay() {
  const m = Math.floor(timerSeconds / 60);
  const s = timerSeconds % 60;
  updateElement('timerDisplay', `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`);
}

// ==================== ডে সিলেক্টর ====================
window.changeDay = function(direction) {
  console.log('changeDay:', direction);
  
  if (!fullData) {
    showToast('ডাটা লোড হচ্ছে...', 'info');
    return;
  }
  
  if (direction === 'next') {
    if (currentDayIndex < fullData.days.length - 1) {
      currentDayIndex++;
      renderAll();
      saveProgress();
      showToast(`📅 দিন ${currentDayIndex + 1}`, 'info');
    } else {
      showToast('এটি শেষ দিন', 'error');
    }
  } else if (direction === 'prev') {
    if (currentDayIndex > 0) {
      currentDayIndex--;
      renderAll();
      saveProgress();
      showToast(`📅 দিন ${currentDayIndex + 1}`, 'info');
    } else {
      showToast('এটি প্রথম দিন', 'error');
    }
  }
};

// ==================== কাউন্টডাউন ====================
function startCountdown() {
  console.log('⏱️ কাউন্টডাউন শুরু হচ্ছে...');
  
  if (countdownInterval) clearInterval(countdownInterval);
  
  countdownInterval = setInterval(() => {
    updateCountdown();
    checkAndUpdateDay();
  }, 1000);
}

function updateCountdown() {
  if (!fullData?.days?.[currentDayIndex]) {
    updateElement('countdownDisplay', '--:--:--');
    return;
  }
  
  const now = new Date();
  const startDate = new Date(2026, 1, 23, 5, 0, 0);
  
  if (now < startDate) {
    const diff = startDate - now;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);
    
    updateElement('countdownDisplay', 
      `${days}d ${hours.toString().padStart(2,'0')}:${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`);
    updateElement('nextActivityName', 'মিশন শুরু হবে আগামীকাল');
    return;
  }
  
  const today = fullData.days[currentDayIndex];
  const nowTime = now.getHours() * 60 + now.getMinutes();
  const nowSeconds = now.getSeconds();
  
  let currentSlot = null;
  let nextSlot = null;
  
  for (let i = 0; i < today.slots.length; i++) {
    const slot = today.slots[i];
    const [start, end] = parseTimeRange(slot.time);
    
    if (start > end) {
      if (nowTime >= start || nowTime < end) {
        currentSlot = slot;
        nextSlot = today.slots[(i + 1) % today.slots.length];
        break;
      }
    } else {
      if (nowTime >= start && nowTime < end) {
        currentSlot = slot;
        nextSlot = today.slots[i + 1] || null;
        break;
      }
    }
  }
  
  if (currentSlot) {
    const [start, end] = parseTimeRange(currentSlot.time);
    
    let totalSecondsLeft;
    if (start > end) {
      if (nowTime >= start) {
        totalSecondsLeft = ((24*60 - nowTime) + end) * 60 - nowSeconds;
      } else {
        totalSecondsLeft = (end - nowTime) * 60 - nowSeconds;
      }
    } else {
      totalSecondsLeft = (end - nowTime) * 60 - nowSeconds;
    }
    
    totalSecondsLeft = Math.max(0, totalSecondsLeft);
    
    const hours = Math.floor(totalSecondsLeft / 3600);
    const minutes = Math.floor((totalSecondsLeft % 3600) / 60);
    const seconds = Math.floor(totalSecondsLeft % 60);
    
    updateElement('countdownDisplay', 
      `${hours.toString().padStart(2,'0')}:${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`);
    updateElement('nextActivityName', currentSlot.activity || 'পড়াশোনা');
    updateElement('nextStartTime', currentSlot.time.split('-')[1] || '--:--');
    updateElement('nextDuration', Math.floor(totalSecondsLeft / 60));
    
    const totalDurationSeconds = (currentSlot.duration || 30) * 60;
    const elapsedSeconds = totalDurationSeconds - totalSecondsLeft;
    const percent = (elapsedSeconds / totalDurationSeconds) * 100;
    
    const progressBar = document.getElementById('progressBar');
    if (progressBar) {
      progressBar.style.width = Math.min(100, Math.max(0, percent)) + '%';
    }
    
    updateElement('nowActivity', currentSlot.activity || 'পড়াশোনা');
    updateElement('nowDetail', currentSlot.detail || '');
    
    if (nextSlot) {
      updateElement('nextActivityShort', nextSlot.activity || 'পড়াশোনা');
      updateElement('nextDetail', nextSlot.detail || '');
    } else {
      updateElement('nextActivityShort', 'শেষ');
      updateElement('nextDetail', 'আজকের শেষ');
    }
    
  } else {
    updateElement('countdownDisplay', '--:--:--');
    updateElement('nextActivityName', 'বিরতি');
    updateElement('nowActivity', 'বিরতি');
    updateElement('nowDetail', 'কোনো সেশন নেই');
  }
}

function checkAndUpdateDay() {
  if (!fullData?.days) return;
  
  const newDayIndex = getCurrentDayIndex();
  if (newDayIndex !== -1 && newDayIndex !== currentDayIndex) {
    currentDayIndex = newDayIndex;
    renderAll();
    showToast(`📅 নতুন দিন শুরু: দিন ${currentDayIndex + 1}`, 'reminder');
  }
}

// ==================== টাইম ফাংশন ====================
function getCurrentDateTime() {
  return new Date();
}

function parseTimeRange(timeStr) {
  try {
    if (!timeStr || !timeStr.includes('-')) return [0, 30];
    
    const parts = timeStr.split('-');
    const start = parts[0].split(':').map(Number);
    const end = parts[1].split(':').map(Number);
    
    const startMinutes = (start[0] || 0) * 60 + (start[1] || 0);
    const endMinutes = (end[0] || 0) * 60 + (end[1] || 0);
    
    return [startMinutes, endMinutes];
  } catch (e) {
    console.warn('টাইম পার্স সমস্যা:', timeStr);
    return [0, 30];
  }
}

function getCurrentDayIndex() {
  if (!fullData?.days) return 0;
  
  const now = getCurrentDateTime();
  const startDate = new Date(2026, 1, 23, 5, 0, 0);
  
  if (now < startDate) return -1;
  
  const endDate = new Date(2026, 2, 5, 22, 0, 0);
  if (now > endDate) return fullData.days.length - 1;
  
  const diffDays = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
  return Math.min(diffDays, fullData.days.length - 1);
}

function updateCurrentDayByTime() {
  if (!fullData?.days) return;
  
  const dayIndex = getCurrentDayIndex();
  
  if (dayIndex === -1) {
    currentDayIndex = 0;
    updateElement('dayStatus', 'দিন ০ · শুরু হয়নি');
  } else {
    currentDayIndex = Math.min(dayIndex, fullData.days.length - 1);
    updateElement('dayStatus', `দিন ${currentDayIndex + 1}`);
  }
  
  updateHeaderDate();
}

function updateHeaderDate() {
  const now = getCurrentDateTime();
  const months = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 
                  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
  updateElement('currentDate', `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`);
}

// ==================== হেল্পার ====================
function updateElement(id, text) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = text;
}

// ==================== ডার্ক মোড ====================
window.toggleDarkMode = function() {
  darkMode = !darkMode;
  document.body.classList.toggle('dark-mode', darkMode);
  const btn = document.querySelector('.dark-mode-toggle');
  if (btn) {
    btn.innerHTML = darkMode ? '<i class="fas fa-sun"></i> লাইট' : '<i class="fas fa-moon"></i> ডার্ক';
  }
  localStorage.setItem('hsc26_darkmode', darkMode);
  showToast(darkMode ? '🌙 ডার্ক মোড' : '☀️ লাইট মোড', 'info');
};

// ==================== ফন্ট সাইজ ====================
window.changeFontSize = function(dir) {
  if (dir === 'increase') currentFontSize = Math.min(currentFontSize + 10, 150);
  else currentFontSize = Math.max(currentFontSize - 10, 70);
  document.body.style.fontSize = currentFontSize + '%';
  localStorage.setItem('hsc26_fontsize', currentFontSize);
  showToast(`ফন্ট সাইজ: ${currentFontSize}%`, 'info');
};

// ==================== স্টোরেজ ====================
function saveProgress() {
  try {
    localStorage.setItem('hsc26_progress', JSON.stringify(userProgress));
    localStorage.setItem('hsc26_last_day', currentDayIndex);
  } catch (e) {}
}

function loadProgress() {
  try {
    const saved = localStorage.getItem('hsc26_progress');
    if (saved) userProgress = JSON.parse(saved);
    
    const lastDay = localStorage.getItem('hsc26_last_day');
    if (lastDay) currentDayIndex = parseInt(lastDay);
  } catch (e) {}
  
  if (localStorage.getItem('hsc26_darkmode') === 'true') {
    setTimeout(() => {
      darkMode = true;
      document.body.classList.add('dark-mode');
      const btn = document.querySelector('.dark-mode-toggle');
      if (btn) btn.innerHTML = '<i class="fas fa-sun"></i> লাইট';
    }, 100);
  }
  
  const fs = localStorage.getItem('hsc26_fontsize');
  if (fs) {
    currentFontSize = parseInt(fs);
    document.body.style.fontSize = currentFontSize + '%';
  }
}

// ==================== নোটিফিকেশন পারমিশন ====================
if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
  Notification.requestPermission();
}

// ==================== কীবোর্ড শর্টকাট ====================
document.addEventListener('keydown', function(e) {
  if (e.key === 'ArrowLeft') window.changeDay('prev');
  else if (e.key === 'ArrowRight') window.changeDay('next');
  else if (e.key === 'Escape') window.closeTimer();
  else if (e.key === 'r' || e.key === 'R') window.setReminder();
});

// ==================== ইনিশিয়ালাইজ ====================
window.addEventListener('load', function() {
  console.log('🚀 HSC 26 চ্যালেঞ্জ শুরু...');
  loadData();
  window.addEventListener('beforeunload', saveProgress);
});

console.log('✅ script.js লোড হয়েছে (রিমাইন্ডার + অগ্রগতি ফিক্স)');