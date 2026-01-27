// Global variables for index page
let allEquipment = [];
let currentFilter = 'all';

// Equipment API functions
const getEquipment = async () => {
  return await apiRequest('/equipment');
};

const getEquipmentById = async (id) => {
  return await apiRequest(`/equipment/${id}`);
};

const createEquipment = async (data) => {
  return await apiRequest('/equipment', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

const updateEquipment = async (id, data) => {
  return await apiRequest(`/equipment/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

const deleteEquipment = async (id) => {
  return await apiRequest(`/equipment/${id}`, {
    method: 'DELETE',
  });
};

// Reservation API functions
const getReservations = async () => {
  return await apiRequest('/reservations');
};

const getMyReservations = async () => {
  return await apiRequest('/reservations/my');
};

const getEquipmentReservations = async (equipmentId) => {
  return await apiRequest(`/reservations/equipment/${equipmentId}`);
};

const getReservationsByRange = async (start, end) => {
  return await apiRequest(`/reservations/range?start=${start}&end=${end}`);
};

const checkReservationConflict = async (equipmentId, startTime, endTime, excludeId = null) => {
  return await apiRequest('/reservations/check-conflict', {
    method: 'POST',
    body: JSON.stringify({
      equipment_id: equipmentId,
      start_time: startTime,
      end_time: endTime,
      exclude_id: excludeId,
    }),
  });
};

const createReservation = async (data) => {
  return await apiRequest('/reservations', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

const updateReservation = async (id, data) => {
  return await apiRequest(`/reservations/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

const cancelReservation = async (id) => {
  return await apiRequest(`/reservations/${id}/cancel`, {
    method: 'PATCH',
  });
};

const deleteReservation = async (id) => {
  return await apiRequest(`/reservations/${id}`, {
    method: 'DELETE',
  });
};

// UI Helper functions
const renderEquipmentCard = (equipment) => {
  const statusClass = equipment.status === 'available' ? 'status-available' : 'status-maintenance';
  const statusText = equipment.status === 'available' ? '사용 가능' : '점검 중';
  const defaultImage = 'https://via.placeholder.com/400x200?text=' + encodeURIComponent(equipment.name);

  return `
    <div class="col-md-6 col-lg-4 mb-4">
      <div class="card equipment-card h-100">
        <div class="cursor-pointer" onclick="showEquipmentDetails(${equipment.id})">
          <img src="${equipment.image_url || defaultImage}" class="card-img-top" alt="${equipment.name}">
          <div class="card-body">
            <h5 class="card-title">${equipment.name}</h5>
            <p class="card-text text-muted">${equipment.description || '설명 없음'}</p>
            <div class="d-flex justify-content-between align-items-center">
              <span class="equipment-status ${statusClass}">${statusText}</span>
              ${equipment.location ? `<small class="text-muted"><i class="bi bi-geo-alt"></i> ${equipment.location}</small>` : ''}
            </div>
          </div>
        </div>
        <div class="card-footer bg-white">
          <button class="btn btn-primary btn-sm w-100" onclick="openReservationModal(${equipment.id})">
            <i class="bi bi-calendar-plus"></i> 예약하기
          </button>
        </div>
      </div>
    </div>
  `;
};

const renderReservationRow = (reservation, showActions = true) => {
  const statusClass = `status-${reservation.status}`;
  const statusText = {
    'confirmed': '확정',
    'pending': '대기',
    'cancelled': '취소됨'
  }[reservation.status];

  // Calculate duration
  const start = new Date(reservation.start_time);
  const end = new Date(reservation.end_time);
  const diffMs = end - start;
  const diffMins = Math.round(diffMs / 60000);
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  const durationText = hours > 0 ? `${hours}시간 ${mins > 0 ? mins + '분' : ''}` : `${mins}분`;

  // Format Time Column (Date + StartTime ~ EndTime)
  const formattedStart = formatDate(reservation.start_time); // "2026. 01. 28. 오전 08:00"
  const formattedEnd = formatDate(reservation.end_time);     // "2026. 01. 28. 오전 08:30"

  const startParts = formattedStart.split(' ');
  const endParts = formattedEnd.split(' ');

  const datePart = startParts.slice(0, 3).join(' ');   // "2026. 01. 28."
  const startTimePart = startParts.slice(3).join(' '); // "오전 08:00"
  const endTimePart = endParts.slice(3).join(' ');     // "오전 08:30"
  const combinedTime = `${datePart} ${startTimePart} ~ ${endTimePart}`;

  return `
    <tr>
      <td class="text-nowrap">${reservation.equipment_name}</td>
      <td class="text-nowrap">${combinedTime}</td>
      <td class="text-nowrap text-center">${durationText}</td>
      <td class="text-center" style="min-width: 250px; max-width: 450px; white-space: normal;">${reservation.purpose || '-'}</td>
      <td class="text-center"><span class="equipment-status ${statusClass}">${statusText}</span></td>
      ${showActions ? `
        <td class="text-center">
          ${reservation.status !== 'cancelled' ? `
            <button class="btn btn-sm btn-danger text-nowrap" onclick="handleCancelReservation(${reservation.id})">
              <i class="bi bi-x-circle"></i> 취소
            </button>
          ` : ''}
        </td>
      ` : ''}
    </tr>
  `;
};

// Show equipment details
let currentEquipmentId = null;

const showEquipmentDetails = async (equipmentId) => {
  currentEquipmentId = equipmentId;

  try {
    const equipment = await getEquipmentById(equipmentId);
    const reservations = await getEquipmentReservations(equipmentId);

    const modalTitle = document.getElementById('equipmentModalLabel');
    const modalBody = document.getElementById('equipmentDetailsBody');

    if (!modalTitle || !modalBody) return;

    const defaultImage = 'https://via.placeholder.com/600x300?text=' + encodeURIComponent(equipment.name);
    const statusClass = equipment.status === 'available' ? 'status-available' : 'status-maintenance';
    const statusText = equipment.status === 'available' ? '사용 가능' : '점검 중';

    modalTitle.textContent = equipment.name;
    modalBody.innerHTML = `
      <img src="${equipment.image_url || defaultImage}" class="img-fluid mb-3 rounded" alt="${equipment.name}">
      <div class="mb-3">
        <h6>상태</h6>
        <span class="equipment-status ${statusClass}">${statusText}</span>
      </div>
      ${equipment.location ? `
        <div class="mb-3">
          <h6>위치</h6>
          <p><i class="bi bi-geo-alt"></i> ${equipment.location}</p>
        </div>
      ` : ''}
      ${equipment.description ? `
        <div class="mb-3">
          <h6>설명</h6>
          <p>${equipment.description}</p>
        </div>
      ` : ''}
      <div class="mb-3">
        <h6>예정된 예약</h6>
        ${reservations.length > 0 ? `
          <div class="list-group">
            ${reservations.slice(0, 5).map(r => `
              <div class="list-group-item">
                <div class="d-flex justify-content-between">
                  <strong>${r.username}</strong>
                  <small class="text-muted">${formatDate(r.start_time)} ~ ${formatDate(r.end_time)}</small>
                </div>
                ${r.purpose ? `<small class="text-muted">${r.purpose}</small>` : ''}
              </div>
            `).join('')}
          </div>
        ` : '<p class="text-muted">예약 없음</p>'}
      </div>
      ${equipment.status === 'available' ? `
        <button class="btn btn-primary w-100 mt-3">
          <i class="bi bi-calendar-plus"></i> 예약하기
        </button>
      ` : ''}
    `;

    const resBtn = modalBody.querySelector('button');
    if (resBtn) {
      resBtn.onclick = () => openReservationModal(equipment.id);
    }

    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('equipmentModal'));
    modal.show();

  } catch (error) {
    alert('장비 정보를 불러오는데 실패했습니다: ' + error.message);
  }
};

// Handle cancel reservation
const handleCancelReservation = async (reservationId) => {
  if (!confirm('예약을 취소하시겠습니까?')) {
    return;
  }

  try {
    await cancelReservation(reservationId);
    alert('예약이 취소되었습니다.');
    window.location.reload();
  } catch (error) {
    alert('예약 취소 실패: ' + error.message);
  }
};

// --- Index Page Specific Functions ---

// Generate time options (30-min intervals)
const generateTimeOptions = () => {
  const select = document.getElementById('reservationStartTime');
  if (!select) return;
  select.innerHTML = '';
  for (let h = 8; h <= 21; h++) {
    for (let m = 0; m < 60; m += 30) {
      const hour = h.toString().padStart(2, '0');
      const min = m.toString().padStart(2, '0');
      const option = document.createElement('option');
      option.value = `${hour}:${min} `;
      option.textContent = `${hour}:${min} `;
      select.appendChild(option);
    }
  }
};

// Calculate and display end time
const updateCalculatedTime = () => {
  const dateStr = document.getElementById('reservationDate')?.value;
  const startTime = document.getElementById('reservationStartTime')?.value;
  const durationField = document.getElementById('reservationDuration');
  const calcDisplay = document.getElementById('calculatedTime');

  if (dateStr && startTime && durationField && calcDisplay) {
    const duration = parseInt(durationField.value);
    const start = new Date(`${dateStr}T${startTime} `);
    const end = new Date(start.getTime() + duration * 60000);
    const endTime = end.toTimeString().slice(0, 5);
    calcDisplay.textContent = `${startTime} ~${endTime} (${duration}분)`;
  }
};

// GUI Grid State
let isDragging = false;
let dragStartIndex = -1;
let dragStartDate = null;

// Load reservation grid (D-day to D+2) - 2-Row Compact Layout
const renderReservationGrid = async (equipmentId) => {
  const container = document.getElementById('reservationGridContainer');
  if (!container) return;
  container.innerHTML = '<div class="spinner-container"><div class="spinner-border text-primary"></div></div>';

  try {
    const today = new Date();
    const dates = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }

    const reservations = await getEquipmentReservations(equipmentId);
    const confirmedReservations = reservations.filter(r => r.status === 'confirmed');

    const dayLabels = ['오늘', '내일', '모레'];
    const hours = [];
    for (let h = 8; h <= 21; h++) {
      hours.push(h.toString().padStart(2, '0'));
    }

    let html = `<div class="reservation-grid">`;

    // Header Row (Hours)
    html += `<div class="grid-header-cell">날짜 \\ 시</div>`;
    hours.forEach(hour => {
      html += `<div class="grid-header-cell">${hour}시</div>`;
    });

    // Each date gets 2 rows
    dates.forEach((date, dateIdx) => {
      // First Row: :00 Slots
      html += `
      <div class="grid-date-column">
          <span class="grid-date-label">${date.split('-').slice(1).join('/')}</span>
          <span class="grid-day-label">${dayLabels[dateIdx]}</span>
        </div>`;

      hours.forEach((hour, hIdx) => {
        const time = `${hour}:00`;
        const slotIdx = hIdx * 2; // 0, 2, 4, ...
        html += renderSlot(date, time, slotIdx, confirmedReservations, false);
      });

      // Second Row: :30 Slots (Empty first cell due to sticky date column)
      // Actually grid-date-column uses grid-row: span 2, so we don't need a label cell here
      hours.forEach((hour, hIdx) => {
        const time = `${hour}:30`;
        const slotIdx = (hIdx * 2) + 1; // 1, 3, 5, ...
        html += renderSlot(date, time, slotIdx, confirmedReservations, true);
      });
    });

    html += `</div>`;
    container.innerHTML = html;

    window.addEventListener('mouseup', () => { isDragging = false; }, { once: true });

  } catch (error) {
    container.innerHTML = '<div class="alert alert-danger m-2">정보를 불러오지 못했습니다.</div>';
  }
};

const renderSlot = (date, time, slotIdx, confirmedReservations, isOddRow) => {
  const slotStart = new Date(`${date}T${time} `);
  const slotEnd = new Date(slotStart.getTime() + 30 * 60000);

  const res = confirmedReservations.find(r => {
    const start = new Date(r.start_time);
    const end = new Date(r.end_time);
    return slotStart < end && slotEnd > start;
  });

  const rowClass = isOddRow ? 'grid-slot-row-30' : '';

  if (res) {
    return `
  <div class="grid-slot reserved ${rowClass}" title="${res.username} (${formatDate(res.start_time).split(' ')[1]}~${formatDate(res.end_time).split(' ')[1]})">
    <span style="font-weight:600;">${res.username.slice(0, 2)}</span>
      </div>`;
  } else {
    return `
  <div class="grid-slot available ${rowClass}"
data-date="${date}"
data-time="${time}"
data-index="${slotIdx}"
data-label="${time.split(':')[1] === '00' ? '정' : '30'}"
onmousedown="handleSlotMouseDown(this)"
onmouseover="handleSlotMouseOver(this)"
onmouseup="handleSlotMouseUp(this)">
      </div>`;
  }
};

// Drag Handlers
window.handleSlotMouseDown = (el) => {
  isDragging = true;
  dragStartIndex = parseInt(el.dataset.index);
  dragStartDate = el.dataset.date;

  clearSelectionStyles();
  el.classList.add('selecting', 'selected-start', 'selected-end');

  updateReservationForm(dragStartDate, el.dataset.time, 30);
};

window.handleSlotMouseOver = (el) => {
  if (!isDragging || el.dataset.date !== dragStartDate) return;

  const currentIndex = parseInt(el.dataset.index);
  const start = Math.min(dragStartIndex, currentIndex);
  const end = Math.max(dragStartIndex, currentIndex);

  // Check for conflicts
  let hasConflict = false;
  for (let i = start; i <= end; i++) {
    const target = document.querySelector(`.grid - slot[data - date="${dragStartDate}"][data - index="${i}"]`);
    if (!target || target.classList.contains('reserved')) {
      hasConflict = true;
      break;
    }
  }

  if (!hasConflict) {
    clearSelectionStyles();
    for (let i = start; i <= end; i++) {
      const target = document.querySelector(`.grid - slot[data - date="${dragStartDate}"][data - index="${i}"]`);
      if (target) {
        target.classList.add('selecting');
        if (i === start) target.classList.add('selected-start');
        if (i === end) target.classList.add('selected-end');
      }
    }

    const startSlot = document.querySelector(`.grid - slot[data - date="${dragStartDate}"][data - index="${start}"]`);
    const startTime = startSlot.dataset.time;
    const duration = (end - start + 1) * 30;
    updateReservationForm(dragStartDate, startTime, duration);
  }
};

window.handleSlotMouseUp = () => {
  isDragging = false;
};

const clearSelectionStyles = () => {
  document.querySelectorAll('.grid-slot').forEach(slot => {
    slot.classList.remove('selecting', 'selected-start', 'selected-end');
  });
};

const updateReservationForm = (date, startTime, duration) => {
  const dateInput = document.getElementById('reservationDate');
  const timeSelect = document.getElementById('reservationStartTime');
  const durationSelect = document.getElementById('reservationDuration');

  if (dateInput) dateInput.value = date;
  if (timeSelect) timeSelect.value = startTime;

  if (durationSelect) {
    if (duration > 240) {
      durationSelect.value = "240";
      // Optionally alert user or just cap it
    } else {
      durationSelect.value = duration.toString();
    }
  }

  updateCalculatedTime();
};

// Render filtered equipment
const renderEquipmentList = () => {
  const container = document.getElementById('equipmentList');
  if (!container) return;

  const filtered = currentFilter === 'all'
    ? allEquipment
    : allEquipment.filter(e => e.location === currentFilter);

  if (filtered.length === 0) {
    container.innerHTML = `
  < div class="empty-state" >
        <i class="bi bi-inbox"></i>
        <h4>해당 위치에 장비가 없습니다</h4>
      </div >
  `;
  } else {
    container.innerHTML = filtered.map(renderEquipmentCard).join('');
  }
};

// Load equipment with location tabs
const loadEquipment = async () => {
  const container = document.getElementById('equipmentList');
  if (!container) return;
  showLoading(container);

  try {
    allEquipment = await getEquipment();

    // Extract unique locations
    const locations = [...new Set(allEquipment.map(e => e.location).filter(Boolean))];

    // Update tabs
    const tabsContainer = document.getElementById('locationTabs');
    if (tabsContainer) {
      tabsContainer.innerHTML = `
  < li class="nav-item" role = "presentation" >
    <button class="nav-link ${currentFilter === 'all' ? 'active' : ''}" data-location="all" type="button">
      전체 <span class="badge bg-secondary">${allEquipment.length}</span>
    </button>
        </li >
  `;
      locations.forEach(loc => {
        const count = allEquipment.filter(e => e.location === loc).length;
        tabsContainer.innerHTML += `
  < li class="nav-item" role = "presentation" >
    <button class="nav-link ${currentFilter === loc ? 'active' : ''}" data-location="${loc}" type="button">
      ${loc} <span class="badge bg-secondary">${count}</span>
    </button>
          </li >
  `;
      });

      // Add tab click handlers
      tabsContainer.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          currentFilter = btn.dataset.location;
          tabsContainer.querySelectorAll('button').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          renderEquipmentList();
        });
      });
    }

    renderEquipmentList();
  } catch (error) {
    showError(container, '장비 목록을 불러오는데 실패했습니다: ' + error.message);
  }
};

// Load user reservations
const loadMyReservations = async () => {
  const section = document.getElementById('myReservationsSection');
  const container = document.getElementById('myReservationsContent');
  if (!section || !container) return;

  if (!isAuthenticated()) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  try {
    const reservations = await getMyReservations();
    const now = new Date();
    const activeReservations = reservations.filter(r =>
      new Date(r.end_time) >= now && r.status !== 'cancelled'
    ).slice(0, 5);

    if (activeReservations.length === 0) {
      container.innerHTML = `
  < div class="text-center text-muted py-3" >
          <i class="bi bi-calendar-x"></i>
          <p class="mb-0">예정된 예약이 없습니다</p>
        </div >
  `;
    } else {
      container.innerHTML = `
  < div class="table-responsive" >
    <table class="table table-hover">
      <thead>
        <tr>
          <th class="text-nowrap">장비</th>
          <th class="text-nowrap">시간</th>
          <th class="text-nowrap text-center">사용시간</th>
          <th class="text-center">사용 목적</th>
          <th class="text-nowrap text-center">상태</th>
          <th class="text-nowrap text-center">작업</th>
        </tr>
      </thead>
      <tbody>
        ${activeReservations.map(r => renderReservationRow(r)).join('')}
      </tbody>
    </table>
        </div >
  `;
    }
  } catch (error) {
    showError(container, '예약 정보를 불러오는데 실패했습니다: ' + error.message);
  }
};

// Open reservation modal
window.openReservationModal = async (equipmentId) => {
  // Check login
  if (!isAuthenticated()) {
    alert('예약하려면 로그인이 필요합니다.');
    window.location.href = 'login.html';
    return;
  }

  currentEquipmentId = equipmentId;

  // Close equipment modal if open and currently shown
  const eqModalEl = document.getElementById('equipmentModal');
  const eqModalInst = bootstrap.Modal.getInstance(eqModalEl);
  if (eqModalInst && eqModalEl.classList.contains('show')) {
    eqModalInst.hide();
    await new Promise(resolve => {
      eqModalEl.addEventListener('hidden.bs.modal', resolve, { once: true });
    });
  }

  // Reset form
  const form = document.getElementById('reservationForm');
  if (form) form.reset();

  const eqIdInput = document.getElementById('reservationEquipmentId');
  if (eqIdInput) eqIdInput.value = equipmentId;

  const warning = document.getElementById('conflictWarning');
  if (warning) warning.style.display = 'none';

  // Set default date to today
  const dateInput = document.getElementById('reservationDate');
  if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
    dateInput.min = today;
  }

  // Generate time options
  generateTimeOptions();
  updateCalculatedTime();

  // Load equipment name
  try {
    const eq = await getEquipmentById(equipmentId);
    const title = document.getElementById('reservationModalLabel');
    if (title) title.textContent = `${eq.name} 예약하기`;
  } catch (err) { }

  // Load reservation grid
  renderReservationGrid(equipmentId);

  const resModalEl = document.getElementById('reservationModal');
  const modal = bootstrap.Modal.getOrCreateInstance(resModalEl);
  modal.show();
};

// Initialize index page
const initIndexPage = () => {
  if (document.getElementById('equipmentList')) {
    loadEquipment();
    loadMyReservations();

    // Event listeners for time calculation
    document.getElementById('reservationDate')?.addEventListener('change', updateCalculatedTime);
    document.getElementById('reservationStartTime')?.addEventListener('change', updateCalculatedTime);
    document.getElementById('reservationDuration')?.addEventListener('change', updateCalculatedTime);

    // Reservation form submission
    document.getElementById('reservationForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();

      const equipmentId = document.getElementById('reservationEquipmentId').value;
      const dateStr = document.getElementById('reservationDate').value;
      const startTime = document.getElementById('reservationStartTime').value;
      const duration = parseInt(document.getElementById('reservationDuration').value);
      const purpose = document.getElementById('reservationPurpose').value;

      const startDateTime = new Date(`${dateStr}T${startTime} `);
      const endDateTime = new Date(startDateTime.getTime() + duration * 60000);
      const now = new Date();

      // Check for past time
      if (startDateTime < now) {
        alert('주의: 현재 시간보다 이전 시간을 선택하셨습니다.');
        if (!confirm('정말로 과거 시간으로 예약을 진행하시겠습니까?')) {
          return;
        }
      }

      try {
        const conflictCheck = await checkReservationConflict(
          equipmentId,
          startDateTime.toISOString(),
          endDateTime.toISOString()
        );

        if (conflictCheck.hasConflict) {
          const warning = document.getElementById('conflictWarning');
          if (warning) warning.style.display = 'block';
          return;
        }

        await createReservation({
          equipment_id: equipmentId,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          purpose: purpose
        });

        const modalEl = document.getElementById('reservationModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();

        alert('예약이 성공적으로 완료되었습니다!');
        window.location.reload();
      } catch (error) {
        alert('예약 생성 실패: ' + error.message);
      }
    });
  }
};

// Page initialization
document.addEventListener('DOMContentLoaded', () => {
  initIndexPage();
});
