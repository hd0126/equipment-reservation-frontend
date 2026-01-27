// Admin page functions

// Load dashboard stats
const loadDashboardStats = async () => {
  try {
    const [equipment, reservations] = await Promise.all([
      getEquipment(),
      getReservations()
    ]);

    const now = new Date();
    const activeReservations = reservations.filter(r =>
      new Date(r.end_time) >= now && r.status === 'confirmed'
    );

    const todayReservations = reservations.filter(r => {
      const start = new Date(r.start_time);
      return start.toDateString() === now.toDateString();
    });

    document.getElementById('totalEquipment').textContent = equipment.length;
    document.getElementById('availableEquipment').textContent =
      equipment.filter(e => e.status === 'available').length;
    document.getElementById('totalReservations').textContent = reservations.length;
    document.getElementById('activeReservations').textContent = activeReservations.length;
    document.getElementById('todayReservations').textContent = todayReservations.length;
  } catch (error) {
    console.error('Failed to load stats:', error);
  }
};

// Load detailed statistics
const loadStatistics = async () => {
  try {
    const stats = await apiRequest('/stats');

    // Render equipment stats (with hours)
    const equipmentTable = document.getElementById('equipmentStatsTable');
    if (equipmentTable) {
      if (stats.equipmentStats && stats.equipmentStats.length > 0) {
        equipmentTable.innerHTML = stats.equipmentStats.map(eq => {
          const hours = parseFloat(eq.total_hours || 0).toFixed(1);
          return `
          <tr>
            <td>${eq.equipment_name}</td>
            <td class="text-center"><span class="badge bg-primary">${eq.total_reservations || 0}</span></td>
            <td class="text-center"><span class="badge bg-success">${eq.confirmed_count || 0}</span></td>
            <td class="text-center"><span class="badge bg-info">${hours}h</span></td>
          </tr>
        `}).join('');
      } else {
        equipmentTable.innerHTML = '<tr><td colspan="4" class="text-center text-muted">예약 데이터 없음</td></tr>';
      }
    }

    // Render user stats (with hours)
    const userTable = document.getElementById('userStatsTable');
    if (userTable) {
      if (stats.userStats && stats.userStats.length > 0) {
        userTable.innerHTML = stats.userStats.map(user => {
          const hours = parseFloat(user.total_hours || 0).toFixed(1);
          return `
          <tr>
            <td>${user.username} <small class="text-muted">(${user.email})</small></td>
            <td class="text-center"><span class="badge bg-primary">${user.total_reservations || 0}</span></td>
            <td class="text-center"><span class="badge bg-success">${user.confirmed_count || 0}</span></td>
            <td class="text-center"><span class="badge bg-info">${hours}h</span></td>
          </tr>
        `}).join('');
      } else {
        userTable.innerHTML = '<tr><td colspan="4" class="text-center text-muted">예약 데이터 없음</td></tr>';
      }
    }
  } catch (error) {
    console.error('Failed to load statistics:', error);
    const eqTable = document.getElementById('equipmentStatsTable');
    if (eqTable) eqTable.innerHTML = `<tr><td colspan="4" class="text-center text-danger">로드 실패: ${error.message}</td></tr>`;
    const uTable = document.getElementById('userStatsTable');
    if (uTable) uTable.innerHTML = `<tr><td colspan="4" class="text-center text-danger">로드 실패: ${error.message}</td></tr>`;
  }
};

// Load equipment management
const loadEquipmentManagement = async () => {
  const container = document.getElementById('equipmentManagementTable');
  showLoading(container);

  try {
    const equipment = await getEquipment();

    if (equipment.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="5" class="text-center text-muted">등록된 장비가 없습니다</td>
        </tr>
      `;
    } else {
      container.innerHTML = equipment.map(e => {
        const statusClass = e.status === 'available' ? 'status-available' : 'status-maintenance';
        const statusText = e.status === 'available' ? '사용 가능' : '점검 중';

        return `
          <tr>
            <td>${e.id}</td>
            <td><strong>${e.name}</strong></td>
            <td>${e.location || '-'}</td>
            <td><span class="equipment-status ${statusClass}">${statusText}</span></td>
            <td>
              <button class="btn btn-sm btn-outline-primary" onclick="editEquipment(${e.id})">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger" onclick="handleDeleteEquipment(${e.id})">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }
  } catch (error) {
    container.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-danger">장비 목록 로드 실패: ${error.message}</td>
      </tr>
    `;
  }
};

// Load reservation management
const loadReservationManagement = async () => {
  const container = document.getElementById('reservationManagementTable');
  showLoading(container);

  try {
    const reservations = await getReservations();

    // Sort by start time descending
    reservations.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));

    if (reservations.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="7" class="text-center text-muted">예약 내역이 없습니다</td>
        </tr>
      `;
    } else {
      container.innerHTML = reservations.slice(0, 20).map(r => {
        const statusClass = `status-${r.status}`;
        const statusText = {
          'confirmed': '확정',
          'pending': '대기',
          'cancelled': '취소됨'
        }[r.status];

        return `
          <tr>
            <td>${r.id}</td>
            <td>${r.equipment_name}</td>
            <td>${r.username}</td>
            <td><small>${formatDate(r.start_time)}</small></td>
            <td><small>${formatDate(r.end_time)}</small></td>
            <td><span class="equipment-status ${statusClass}">${statusText}</span></td>
            <td>
              ${r.status === 'cancelled' ? `
                <button class="btn btn-sm btn-outline-success" onclick="handleRestoreReservation(${r.id})" title="복구">
                  <i class="bi bi-arrow-counterclockwise"></i>
                </button>
              ` : `
                <button class="btn btn-sm btn-outline-danger" onclick="handleAdminCancelReservation(${r.id})" title="취소">
                  <i class="bi bi-x-circle"></i>
                </button>
              `}
              <button class="btn btn-sm btn-outline-danger" onclick="handleAdminDeleteReservation(${r.id})" title="삭제">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }
  } catch (error) {
    container.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-danger">예약 목록 로드 실패: ${error.message}</td>
      </tr>
    `;
  }
};

// Open add equipment modal
const openAddEquipmentModal = () => {
  document.getElementById('equipmentForm').reset();
  document.getElementById('equipmentId').value = '';
  document.getElementById('equipmentModalLabel').textContent = '새 장비 추가';

  const modal = new bootstrap.Modal(document.getElementById('equipmentModal'));
  modal.show();
};

// Edit equipment
window.editEquipment = async (id) => {
  try {
    const equipment = await getEquipmentById(id);

    document.getElementById('equipmentId').value = equipment.id;
    document.getElementById('equipmentName').value = equipment.name;
    document.getElementById('equipmentDescription').value = equipment.description || '';
    document.getElementById('equipmentLocation').value = equipment.location || '';
    document.getElementById('equipmentStatus').value = equipment.status;
    document.getElementById('equipmentImageUrl').value = equipment.image_url || '';

    document.getElementById('equipmentModalLabel').textContent = '장비 수정';

    const modal = new bootstrap.Modal(document.getElementById('equipmentModal'));
    modal.show();
  } catch (error) {
    alert('장비 정보를 불러오는데 실패했습니다: ' + error.message);
  }
};

// Handle equipment form submission
document.addEventListener('DOMContentLoaded', () => {
  const equipmentForm = document.getElementById('equipmentForm');
  if (equipmentForm) {
    equipmentForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Create FormData or JSON payload
      const formData = new FormData();
      const equipmentId = document.getElementById('equipmentId').value; // Explicitly get value
      const name = document.getElementById('equipmentName').value;
      const description = document.getElementById('equipmentDescription').value;
      const location = document.getElementById('equipmentLocation').value;
      const status = document.getElementById('equipmentStatus').value;
      const imageUrl = document.getElementById('equipmentImageUrl').value;
      const imageFile = document.getElementById('equipmentImageFile').files[0];

      formData.append('name', name);
      formData.append('description', description);
      formData.append('location', location);
      formData.append('status', status);

      if (imageUrl) formData.append('image_url', imageUrl);
      if (imageFile) formData.append('image', imageFile);

      try {
        if (equipmentId) {
          // For update, currently only JSON is supported for simplicity or need backend update
          // If you need file update, backend PUT needs Multer too.
          // Let's stick to JSON for update unless critical.
          const data = { name, description, location, status, image_url: imageUrl };
          await updateEquipment(equipmentId, data);
          alert('장비가 수정되었습니다.');
        } else {
          // For create, use FormData if file exists, else JSON
          if (imageFile) {
            await apiRequest('/equipment', {
              method: 'POST',
              body: formData,
              // Content-Type header must be undefined for FormData to set boundary automatically
              headers: {}
            });
          } else {
            const data = { name, description, location, status, image_url: imageUrl };
            await createEquipment(data);
          }
          alert('장비가 추가되었습니다.');
        }

        const modal = bootstrap.Modal.getInstance(document.getElementById('equipmentModal'));
        modal.hide();

        loadEquipmentManagement();
        loadDashboardStats();
      } catch (error) {
        alert('작업 실패: ' + error.message);
      }
    });
  }
});

// Delete equipment
window.handleDeleteEquipment = async (id) => {
  if (!confirm('이 장비를 삭제하시겠습니까? 관련된 모든 예약도 삭제됩니다.')) {
    return;
  }

  try {
    await deleteEquipment(id);
    alert('장비가 삭제되었습니다.');
    loadEquipmentManagement();
    loadDashboardStats();
  } catch (error) {
    alert('장비 삭제 실패: ' + error.message);
  }
};

// Cancel reservation (admin)
window.handleAdminCancelReservation = async (id) => {
  if (!confirm('이 예약을 취소하시겠습니까?')) {
    return;
  }

  try {
    await cancelReservation(id);
    alert('예약이 취소되었습니다.');
    loadReservationManagement();
    loadDashboardStats();
  } catch (error) {
    alert('예약 취소 실패: ' + error.message);
  }
};

// Delete reservation (admin)
window.handleAdminDeleteReservation = async (id) => {
  if (!confirm('이 예약을 완전히 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
    return;
  }

  try {
    await deleteReservation(id);
    alert('예약이 삭제되었습니다.');
    loadReservationManagement();
    loadDashboardStats();
  } catch (error) {
    alert('예약 삭제 실패: ' + error.message);
  }
};

// Restore cancelled reservation (admin)
window.handleRestoreReservation = async (id) => {
  if (!confirm('이 예약을 복구하시겠습니까?')) {
    return;
  }

  try {
    await apiRequest(`/reservations/${id}/restore`, { method: 'PATCH' });
    alert('예약이 복구되었습니다.');
    loadReservationManagement();
    loadDashboardStats();
    loadStatistics();
  } catch (error) {
    alert('예약 복구 실패: ' + error.message);
  }
};

// Initialize admin page
document.addEventListener('DOMContentLoaded', () => {
  // Check admin access
  requireAdmin();

  // Load all data
  loadDashboardStats();
  loadEquipmentManagement();
  loadReservationManagement();
  loadStatistics(); // Add statistics loading
});
