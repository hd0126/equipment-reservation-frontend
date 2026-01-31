let calendar = null;
let currentEquipmentFilter = null;
let permittedEquipment = []; // Equipment user has permission to use

// Initialize calendar
const initCalendar = () => {
  const calendarEl = document.getElementById('calendar');

  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay'
    },
    locale: 'ko',
    buttonText: {
      today: '오늘',
      month: '월',
      week: '주',
      day: '일'
    },
    height: 'auto',
    selectable: true, // Enable date/time selection
    selectMirror: true,
    events: loadCalendarEvents,
    eventClick: handleEventClick,
    select: handleDateSelect, // Handle date/time selection
    eventColor: '#0d6efd',
    eventTimeFormat: {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }
  });

  calendar.render();
};

// Handle date/time selection for new reservation
const handleDateSelect = (info) => {
  // Check if equipment is selected
  if (!currentEquipmentFilter) {
    alert('예약할 장비를 먼저 선택해주세요.\n\n우측 상단에서 장비를 선택 후 날짜를 클릭하세요.');
    calendar.unselect();
    return;
  }

  // Check if user has permission for this equipment
  const hasPermission = permittedEquipment.some(e => e.id === currentEquipmentFilter);
  if (!hasPermission) {
    alert('해당 장비에 대한 예약 권한이 없습니다.');
    calendar.unselect();
    return;
  }

  // Get selected equipment info
  const selectedEquipment = permittedEquipment.find(e => e.id === currentEquipmentFilter);

  // Open calendar reservation modal
  openCalendarReservationModal(selectedEquipment, info);

  calendar.unselect();
};

// Open calendar reservation modal
const openCalendarReservationModal = (equipment, info) => {
  // Set equipment info
  document.getElementById('calReservationEquipmentId').value = equipment.id;
  document.getElementById('calSelectedEquipmentName').textContent = equipment.name;

  // Get selected date
  const selectedDate = info.startStr.split('T')[0];
  document.getElementById('calReservationDate').value = selectedDate;
  document.getElementById('calSelectedDate').textContent = new Date(selectedDate).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
  });

  // Generate time options
  const timeSelect = document.getElementById('calStartTime');
  timeSelect.innerHTML = '';
  for (let h = 8; h <= 21; h++) {
    for (let m = 0; m < 60; m += 30) {
      const hour = h.toString().padStart(2, '0');
      const min = m.toString().padStart(2, '0');
      const option = document.createElement('option');
      option.value = `${hour}:${min}`;
      option.textContent = `${hour}:${min}`;
      timeSelect.appendChild(option);
    }
  }

  // If time was selected in week/day view, set start time and calculate duration
  const durationSelect = document.getElementById('calDuration');
  if (info.startStr.includes('T') && info.endStr && info.endStr.includes('T')) {
    // Set start time
    const startTime = info.startStr.split('T')[1].substring(0, 5);
    timeSelect.value = startTime;

    // Calculate duration from dragged range
    const startDate = new Date(info.start);
    const endDate = new Date(info.end);
    const durationMins = Math.round((endDate - startDate) / 60000);

    // Set duration if it's a valid option (30, 60, 90, 120, 150, 180, 210, 240)
    const validDurations = [30, 60, 90, 120, 150, 180, 210, 240];
    if (validDurations.includes(durationMins)) {
      durationSelect.value = durationMins.toString();
    } else if (durationMins > 240) {
      durationSelect.value = '240'; // Cap at 4 hours
    } else {
      // Round to nearest valid duration
      const nearest = validDurations.reduce((prev, curr) =>
        Math.abs(curr - durationMins) < Math.abs(prev - durationMins) ? curr : prev
      );
      durationSelect.value = nearest.toString();
    }
  } else {
    // Month view - set start time to next 30-minute interval from current time
    const now = new Date();
    const selectedDateStr = info.startStr.split('T')[0];
    const selectedDate = new Date(selectedDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);

    let defaultHour, defaultMin;

    if (selectedDate.getTime() === today.getTime()) {
      // Today - calculate next 30-minute slot
      const currentHour = now.getHours();
      const currentMin = now.getMinutes();

      if (currentMin < 30) {
        defaultHour = currentHour;
        defaultMin = 30;
      } else {
        defaultHour = currentHour + 1;
        defaultMin = 0;
      }

      // Ensure within operating hours (08:00 - 22:00)
      if (defaultHour < 8) {
        defaultHour = 8;
        defaultMin = 0;
      } else if (defaultHour >= 22) {
        defaultHour = 21;
        defaultMin = 30;
      }
    } else if (selectedDate > today) {
      // Future date - default to 08:00
      defaultHour = 8;
      defaultMin = 0;
    } else {
      // Past date - default to 08:00 (shouldn't normally happen)
      defaultHour = 8;
      defaultMin = 0;
    }

    const defaultTime = `${defaultHour.toString().padStart(2, '0')}:${defaultMin.toString().padStart(2, '0')}`;
    timeSelect.value = defaultTime;
    durationSelect.value = '60'; // Default 1 hour
  }

  // Reset purpose
  document.getElementById('calPurpose').value = '';

  // Show modal
  const modal = new bootstrap.Modal(document.getElementById('calendarReservationModal'));
  modal.show();
};

// Load calendar events
const loadCalendarEvents = async (info, successCallback, failureCallback) => {
  try {
    const start = info.start.toISOString();
    const end = info.end.toISOString();

    const reservations = await getReservationsByRange(start, end);

    // Filter by equipment if selected
    let filteredReservations = reservations;
    if (currentEquipmentFilter) {
      filteredReservations = reservations.filter(r => r.equipment_id === currentEquipmentFilter);
    }

    // Convert to FullCalendar event format
    const events = filteredReservations.map(r => ({
      id: r.id,
      title: `${r.equipment_name} - ${r.username}`,
      start: r.start_time,
      end: r.end_time,
      extendedProps: {
        equipmentName: r.equipment_name,
        equipmentLocation: r.equipment_location,
        username: r.username,
        email: r.email,
        purpose: r.purpose,
        status: r.status,
        reservationId: r.id
      },
      backgroundColor: getEventColor(r.status),
      borderColor: getEventColor(r.status)
    }));

    successCallback(events);
  } catch (error) {
    console.error('Failed to load calendar events:', error);
    failureCallback(error);
  }
};

// Get event color based on status
const getEventColor = (status) => {
  const colors = {
    'confirmed': '#198754',
    'pending': '#ffc107',
    'cancelled': '#dc3545'
  };
  return colors[status] || '#0d6efd';
};

// Handle event click
const handleEventClick = (info) => {
  const props = info.event.extendedProps;
  const user = getUser();

  const statusClass = `status-${props.status}`;
  const statusText = {
    'confirmed': '확정',
    'pending': '대기',
    'cancelled': '취소됨'
  }[props.status];

  const modalTitle = document.getElementById('eventModalLabel');
  const modalBody = document.getElementById('eventDetailsBody');

  modalTitle.textContent = props.equipmentName;

  const canCancel = user && (user.email === props.email || user.role === 'admin') && props.status !== 'cancelled';

  modalBody.innerHTML = `
    <div class="mb-3">
      <h6><i class="bi bi-gear"></i> 장비</h6>
      <p class="mb-1">${props.equipmentName}</p>
      ${props.equipmentLocation ? `<small class="text-muted"><i class="bi bi-geo-alt"></i> ${props.equipmentLocation}</small>` : ''}
    </div>
    
    <div class="mb-3">
      <h6><i class="bi bi-person"></i> 예약자</h6>
      <p class="mb-0">${props.username}</p>
      <small class="text-muted">${props.email}</small>
    </div>
    
    <div class="mb-3">
      <h6><i class="bi bi-clock"></i> 예약 시간</h6>
      <p class="mb-1"><strong>시작:</strong> ${formatDate(info.event.start)}</p>
      <p class="mb-0"><strong>종료:</strong> ${formatDate(info.event.end)}</p>
    </div>
    
    ${props.purpose ? `
      <div class="mb-3">
        <h6><i class="bi bi-file-text"></i> 사용 목적</h6>
        <p class="mb-0">${props.purpose}</p>
      </div>
    ` : ''}
    
    <div class="mb-3">
      <h6><i class="bi bi-info-circle"></i> 상태</h6>
      <span class="equipment-status ${statusClass}">${statusText}</span>
    </div>
    
    ${canCancel ? `
      <button class="btn btn-danger w-100" onclick="handleCancelReservationFromCalendar(${props.reservationId})">
        <i class="bi bi-x-circle"></i> 예약 취소
      </button>
    ` : ''}
  `;

  const modal = new bootstrap.Modal(document.getElementById('eventModal'));
  modal.show();
};

// Handle cancel reservation from calendar
const handleCancelReservationFromCalendar = async (reservationId) => {
  if (!confirm('예약을 취소하시겠습니까?')) {
    return;
  }

  try {
    await cancelReservation(reservationId);

    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('eventModal'));
    modal.hide();

    // Reload calendar
    calendar.refetchEvents();

    alert('예약이 취소되었습니다.');
  } catch (error) {
    alert('예약 취소 실패: ' + error.message);
  }
};

// Load equipment filter options (filtered by user permissions)
const loadEquipmentFilter = async () => {
  try {
    const user = getCurrentUser();
    const select = document.getElementById('equipmentFilter');

    // Get all equipment first
    const allEquipment = await getEquipment();

    // Filter equipment based on user permissions
    if (user && (user.user_role === 'admin' || user.user_role === 'equipment_manager')) {
      // Admin and equipment managers can see all equipment
      permittedEquipment = allEquipment;
    } else if (user) {
      // Regular users - get their permitted equipment
      try {
        const myPermissions = await apiRequest('/permissions/my');
        const permittedIds = myPermissions.map(p => p.equipment_id);
        permittedEquipment = allEquipment.filter(e => permittedIds.includes(e.id));
      } catch (e) {
        console.log('Could not fetch permissions, showing all equipment for viewing');
        permittedEquipment = allEquipment;
      }
    } else {
      permittedEquipment = allEquipment;
    }

    // Build select options
    select.innerHTML = '<option value="">전체 장비 (조회용)</option>';

    if (permittedEquipment.length > 0) {
      const optGroup = document.createElement('optgroup');
      optGroup.label = '예약 가능 장비';
      permittedEquipment.forEach(e => {
        const option = document.createElement('option');
        option.value = e.id;
        option.textContent = e.name;
        optGroup.appendChild(option);
      });
      select.appendChild(optGroup);
    }

    // Add view-only equipment (not permitted but can view)
    const viewOnlyEquipment = allEquipment.filter(e => !permittedEquipment.some(p => p.id === e.id));
    if (viewOnlyEquipment.length > 0) {
      const viewOptGroup = document.createElement('optgroup');
      viewOptGroup.label = '조회만 가능';
      viewOnlyEquipment.forEach(e => {
        const option = document.createElement('option');
        option.value = e.id;
        option.textContent = `${e.name} (조회용)`;
        option.dataset.viewOnly = 'true';
        viewOptGroup.appendChild(option);
      });
      select.appendChild(viewOptGroup);
    }

    select.addEventListener('change', (e) => {
      currentEquipmentFilter = e.target.value ? parseInt(e.target.value) : null;
      calendar.refetchEvents();
    });
  } catch (error) {
    console.error('Failed to load equipment filter:', error);
  }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  // Check authentication
  requireAuth();

  // Initialize calendar
  initCalendar();

  // Load equipment filter
  loadEquipmentFilter();

  // Setup calendar reservation form
  const calForm = document.getElementById('calendarReservationForm');
  if (calForm) {
    calForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const equipmentId = document.getElementById('calReservationEquipmentId').value;
      const date = document.getElementById('calReservationDate').value;
      const startTime = document.getElementById('calStartTime').value;
      const duration = parseInt(document.getElementById('calDuration').value);
      const purpose = document.getElementById('calPurpose').value;

      // Calculate end time
      const startDateTime = new Date(`${date}T${startTime}`);
      const endDateTime = new Date(startDateTime.getTime() + duration * 60000);

      try {
        // Check for conflicts
        const conflict = await checkReservationConflict(
          equipmentId,
          startDateTime.toISOString(),
          endDateTime.toISOString()
        );

        if (conflict.hasConflict) {
          alert('선택한 시간에 이미 예약이 있습니다.\n다른 시간을 선택해주세요.');
          return;
        }

        // Create reservation
        await createReservation({
          equipment_id: parseInt(equipmentId),
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          purpose: purpose
        });

        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('calendarReservationModal'));
        modal.hide();

        // Refresh calendar
        calendar.refetchEvents();

        alert('예약이 완료되었습니다!');
      } catch (error) {
        alert('예약 실패: ' + error.message);
      }
    });
  }
});
