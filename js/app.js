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
      <div class="card equipment-card" onclick="showEquipmentDetails(${equipment.id})">
        <img src="${equipment.image_url || defaultImage}" class="card-img-top" alt="${equipment.name}">
        <div class="card-body">
          <h5 class="card-title">${equipment.name}</h5>
          <p class="card-text text-muted">${equipment.description || '설명 없음'}</p>
          <div class="d-flex justify-content-between align-items-center">
            <span class="equipment-status ${statusClass}">${statusText}</span>
            ${equipment.location ? `<small class="text-muted"><i class="bi bi-geo-alt"></i> ${equipment.location}</small>` : ''}
          </div>
        </div>
        <div class="card-footer bg-white">
          <button class="btn btn-primary btn-sm w-100" onclick="event.stopPropagation(); openReservationModal(${equipment.id})">
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

  return `
    <tr>
      <td>${reservation.equipment_name}</td>
      <td>${formatDate(reservation.start_time)}</td>
      <td>${formatDate(reservation.end_time)}</td>
      <td>${reservation.purpose || '-'}</td>
      <td><span class="equipment-status ${statusClass}">${statusText}</span></td>
      ${showActions ? `
        <td>
          ${reservation.status !== 'cancelled' ? `
            <button class="btn btn-sm btn-danger" onclick="handleCancelReservation(${reservation.id})">
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
        <button class="btn btn-primary w-100" onclick="openReservationModal(${equipment.id})">
          <i class="bi bi-calendar-plus"></i> 예약하기
        </button>
      ` : ''}
    `;
    
    const modal = new bootstrap.Modal(document.getElementById('equipmentModal'));
    modal.show();
    
  } catch (error) {
    alert('장비 정보를 불러오는데 실패했습니다: ' + error.message);
  }
};

// Open reservation modal
const openReservationModal = (equipmentId) => {
  currentEquipmentId = equipmentId;
  
  // Close equipment modal if open
  const equipmentModal = bootstrap.Modal.getInstance(document.getElementById('equipmentModal'));
  if (equipmentModal) {
    equipmentModal.hide();
  }
  
  // Reset form
  document.getElementById('reservationForm').reset();
  document.getElementById('reservationEquipmentId').value = equipmentId;
  document.getElementById('conflictWarning').style.display = 'none';
  
  // Set minimum date to now
  const now = new Date();
  const minDateTime = formatDateForInput(now);
  document.getElementById('reservationStart').min = minDateTime;
  document.getElementById('reservationEnd').min = minDateTime;
  
  // Load equipment info
  getEquipmentById(equipmentId).then(equipment => {
    document.getElementById('reservationModalLabel').textContent = `${equipment.name} 예약하기`;
  });
  
  const modal = new bootstrap.Modal(document.getElementById('reservationModal'));
  modal.show();
};

// Handle reservation form submission
document.addEventListener('DOMContentLoaded', () => {
  const reservationForm = document.getElementById('reservationForm');
  if (reservationForm) {
    reservationForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const equipmentId = document.getElementById('reservationEquipmentId').value;
      const startTime = document.getElementById('reservationStart').value;
      const endTime = document.getElementById('reservationEnd').value;
      const purpose = document.getElementById('reservationPurpose').value;
      
      try {
        // Check for conflicts
        const conflictCheck = await checkReservationConflict(equipmentId, startTime, endTime);
        
        if (conflictCheck.hasConflict) {
          document.getElementById('conflictWarning').style.display = 'block';
          return;
        }
        
        // Create reservation
        await createReservation({
          equipment_id: equipmentId,
          start_time: startTime,
          end_time: endTime,
          purpose: purpose
        });
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('reservationModal'));
        modal.hide();
        
        // Show success message
        alert('예약이 완료되었습니다!');
        
        // Reload page
        window.location.reload();
        
      } catch (error) {
        alert('예약 생성 실패: ' + error.message);
      }
    });
  }
  
  // Check conflict on time change
  const startInput = document.getElementById('reservationStart');
  const endInput = document.getElementById('reservationEnd');
  
  if (startInput && endInput) {
    const checkConflictOnChange = async () => {
      const equipmentId = document.getElementById('reservationEquipmentId').value;
      const startTime = startInput.value;
      const endTime = endInput.value;
      
      if (equipmentId && startTime && endTime) {
        try {
          const conflictCheck = await checkReservationConflict(equipmentId, startTime, endTime);
          document.getElementById('conflictWarning').style.display = conflictCheck.hasConflict ? 'block' : 'none';
        } catch (error) {
          console.error('Conflict check failed:', error);
        }
      }
    };
    
    startInput.addEventListener('change', checkConflictOnChange);
    endInput.addEventListener('change', checkConflictOnChange);
  }
});

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
