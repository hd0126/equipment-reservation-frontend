let calendar = null;
let currentEquipmentFilter = null;

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
    events: loadCalendarEvents,
    eventClick: handleEventClick,
    eventColor: '#0d6efd',
    eventTimeFormat: {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }
  });
  
  calendar.render();
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

// Load equipment filter options
const loadEquipmentFilter = async () => {
  try {
    const equipment = await getEquipment();
    const select = document.getElementById('equipmentFilter');
    
    select.innerHTML = '<option value="">전체 장비</option>';
    equipment.forEach(e => {
      const option = document.createElement('option');
      option.value = e.id;
      option.textContent = e.name;
      select.appendChild(option);
    });
    
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
});
