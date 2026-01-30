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

// Cached stats data for Excel export
let lastStatsData = null;

// Load detailed statistics with optional date range
const loadStatistics = async (startDate, endDate) => {
  try {
    let url = '/stats';
    if (startDate && endDate) {
      url += `?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`;
    }
    const stats = await apiRequest(url);
    lastStatsData = stats;

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
          <td colspan="6" class="text-center text-muted">등록된 장비가 없습니다</td>
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
            <td>
              ${e.manager_name ? `<span class="badge bg-info">${e.manager_name}</span>` : '<span class="text-muted">-</span>'}
              <button class="btn btn-sm btn-outline-secondary ms-1" onclick="openManagerModal(${e.id}, '${e.name}')" title="담당자 지정">
                <i class="bi bi-person-gear"></i>
              </button>
            </td>
            <td><span class="equipment-status ${statusClass}">${statusText}</span></td>
            <td>
              <button class="btn btn-sm btn-outline-primary" onclick="editEquipment(${e.id})" title="수정">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-sm btn-outline-success" onclick="openPermissionModal(${e.id}, '${e.name}')" title="권한 관리">
                <i class="bi bi-person-check"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger" onclick="handleDeleteEquipment(${e.id})" title="삭제">
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
        <td colspan="6" class="text-center text-danger">장비 목록 로드 실패: ${error.message}</td>
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

    // 현재 문서 파일 표시 (삭제 버튼 포함)
    const currentBrochure = document.getElementById('currentBrochure');
    const currentManual = document.getElementById('currentManual');
    const currentQuickGuide = document.getElementById('currentQuickGuide');

    if (currentBrochure) {
      currentBrochure.innerHTML = equipment.brochure_url
        ? `<a href="${equipment.brochure_url}" target="_blank">📄 현재 파일 보기</a>
           <button type="button" class="btn btn-sm btn-outline-danger ms-2" onclick="handleDeleteDocument(${equipment.id}, 'brochure', '${equipment.brochure_url}')">❌ 삭제</button>`
        : '';
    }
    if (currentManual) {
      currentManual.innerHTML = equipment.manual_url
        ? `<a href="${equipment.manual_url}" target="_blank">📄 현재 파일 보기</a>
           <button type="button" class="btn btn-sm btn-outline-danger ms-2" onclick="handleDeleteDocument(${equipment.id}, 'manual', '${equipment.manual_url}')">❌ 삭제</button>`
        : '';
    }
    if (currentQuickGuide) {
      currentQuickGuide.innerHTML = equipment.quick_guide_url
        ? `<a href="${equipment.quick_guide_url}" target="_blank">📄 현재 파일 보기</a>
           <button type="button" class="btn btn-sm btn-outline-danger ms-2" onclick="handleDeleteDocument(${equipment.id}, 'quick_guide', '${equipment.quick_guide_url}')">❌ 삭제</button>`
        : '';
    }

    document.getElementById('equipmentModalLabel').textContent = '장비 수정';

    const modal = new bootstrap.Modal(document.getElementById('equipmentModal'));
    modal.show();
  } catch (error) {
    alert('장비 정보를 불러오는데 실패했습니다: ' + error.message);
  }
};

// 파일을 Base64로 변환
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
};

// 파일 크기 검증 (20MB 제한)
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const validateFileSize = (file) => {
  if (file.size > MAX_FILE_SIZE) {
    alert(`파일 크기가 너무 큽니다.\n\n선택한 파일: ${(file.size / 1024 / 1024).toFixed(2)}MB\n최대 허용: 20MB\n\n더 작은 파일을 선택해주세요.`);
    return false;
  }
  return true;
};

// 문서 파일 업로드
const uploadDocument = async (file, type, equipmentId) => {
  if (!validateFileSize(file)) {
    throw new Error('파일 크기 초과');
  }
  const base64 = await fileToBase64(file);
  const response = await apiRequest('/upload', {
    method: 'POST',
    body: JSON.stringify({
      file: base64,
      filename: file.name,
      type: type,
      equipmentId: equipmentId
    })
  });
  return response.url;
};

// 문서 파일 삭제
const deleteDocument = async (equipmentId, type, fileUrl) => {
  if (!confirm('이 문서를 삭제하시겠습니까?')) {
    return false;
  }
  try {
    await apiRequest('/upload', {
      method: 'DELETE',
      body: JSON.stringify({
        equipmentId: equipmentId,
        type: type,
        fileUrl: fileUrl
      })
    });
    alert('문서가 삭제되었습니다.');
    return true;
  } catch (error) {
    alert('문서 삭제 실패: ' + error.message);
    return false;
  }
};

// 글로벌 삭제 핸들러 (onclick에서 호출)
window.handleDeleteDocument = async (equipmentId, type, fileUrl) => {
  const deleted = await deleteDocument(equipmentId, type, fileUrl);
  if (deleted) {
    // 삭제 후 UI 업데이트
    const elementId = {
      'brochure': 'currentBrochure',
      'manual': 'currentManual',
      'quick_guide': 'currentQuickGuide'
    }[type];
    const element = document.getElementById(elementId);
    if (element) {
      element.innerHTML = '';
    }
  }
};

// 파일 선택 시 즉시 크기 검증
document.addEventListener('DOMContentLoaded', () => {
  const fileInputs = ['equipmentBrochure', 'equipmentManual', 'equipmentQuickGuide'];
  fileInputs.forEach(inputId => {
    const input = document.getElementById(inputId);
    if (input) {
      input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && !validateFileSize(file)) {
          e.target.value = ''; // 파일 선택 취소
        }
      });
    }
  });
});

// Handle equipment form submission
document.addEventListener('DOMContentLoaded', () => {
  const equipmentForm = document.getElementById('equipmentForm');
  if (equipmentForm) {
    equipmentForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Create FormData or JSON payload
      const formData = new FormData();
      const equipmentId = document.getElementById('equipmentId').value;
      const name = document.getElementById('equipmentName').value;
      const description = document.getElementById('equipmentDescription').value;
      const location = document.getElementById('equipmentLocation').value;
      const status = document.getElementById('equipmentStatus').value;
      const imageUrl = document.getElementById('equipmentImageUrl').value;
      const imageFile = document.getElementById('equipmentImageFile').files[0];

      // 문서 파일들
      const brochureFile = document.getElementById('equipmentBrochure')?.files[0];
      const manualFile = document.getElementById('equipmentManual')?.files[0];
      const quickGuideFile = document.getElementById('equipmentQuickGuide')?.files[0];

      formData.append('name', name);
      formData.append('description', description);
      formData.append('location', location);
      formData.append('status', status);

      if (imageUrl) formData.append('image_url', imageUrl);
      if (imageFile) formData.append('image', imageFile);

      try {
        let savedEquipmentId = equipmentId;

        if (equipmentId) {
          // Update existing equipment
          const data = { name, description, location, status, image_url: imageUrl };
          await updateEquipment(equipmentId, data);
        } else {
          // Create new equipment
          if (imageFile) {
            const result = await apiRequest('/equipment', {
              method: 'POST',
              body: formData,
              headers: {}
            });
            savedEquipmentId = result.id;
          } else {
            const data = { name, description, location, status, image_url: imageUrl };
            const result = await createEquipment(data);
            savedEquipmentId = result.id;
          }
        }

        // 문서 파일 업로드 (장비 저장 후)
        if (savedEquipmentId) {
          let brochureUrl = null, manualUrl = null, quickGuideUrl = null;

          if (brochureFile) {
            brochureUrl = await uploadDocument(brochureFile, 'brochure', savedEquipmentId);
          }
          if (manualFile) {
            manualUrl = await uploadDocument(manualFile, 'manual', savedEquipmentId);
          }
          if (quickGuideFile) {
            quickGuideUrl = await uploadDocument(quickGuideFile, 'quick_guide', savedEquipmentId);
          }

          // 문서 URL이 있으면 장비 업데이트
          if (brochureUrl || manualUrl || quickGuideUrl) {
            const existingEquipment = await getEquipmentById(savedEquipmentId);
            await updateEquipment(savedEquipmentId, {
              name: existingEquipment.name,
              description: existingEquipment.description,
              location: existingEquipment.location,
              status: existingEquipment.status,
              image_url: existingEquipment.image_url,
              brochure_url: brochureUrl || existingEquipment.brochure_url,
              manual_url: manualUrl || existingEquipment.manual_url,
              quick_guide_url: quickGuideUrl || existingEquipment.quick_guide_url
            });
          }
        }

        alert(equipmentId ? '장비가 수정되었습니다.' : '장비가 추가되었습니다.');

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

// Period selection helpers
window.setStatsPeriod = (period) => {
  const startInput = document.getElementById('statsStartDate');
  const endInput = document.getElementById('statsEndDate');
  if (!startInput || !endInput) return;

  const now = new Date();
  let start, end;

  switch (period) {
    case 'thisMonth':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      break;
    case 'lastMonth':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'last3Months':
      start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      break;
    case 'thisYear':
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear() + 1, 0, 1);
      break;
    case 'all':
      startInput.value = '';
      endInput.value = '';
      return;
  }

  startInput.value = start.toISOString().split('T')[0];
  endInput.value = end.toISOString().split('T')[0];
};

window.applyStatsPeriod = () => {
  const startDate = document.getElementById('statsStartDate')?.value || null;
  const endDate = document.getElementById('statsEndDate')?.value || null;
  loadStatistics(startDate, endDate);
};

// Excel export
window.exportStatsToExcel = () => {
  if (!lastStatsData) {
    alert('먼저 통계를 조회해주세요.');
    return;
  }

  if (typeof XLSX === 'undefined') {
    alert('엑셀 라이브러리가 로드되지 않았습니다.');
    return;
  }

  const wb = XLSX.utils.book_new();

  // Equipment stats sheet
  if (lastStatsData.equipmentStats && lastStatsData.equipmentStats.length > 0) {
    const eqData = lastStatsData.equipmentStats.map(eq => ({
      '장비명': eq.equipment_name,
      '총 예약': Number(eq.total_reservations || 0),
      '확정': Number(eq.confirmed_count || 0),
      '취소': Number(eq.cancelled_count || 0),
      '총 시간(h)': parseFloat(parseFloat(eq.total_hours || 0).toFixed(1))
    }));
    const eqSheet = XLSX.utils.json_to_sheet(eqData);
    XLSX.utils.book_append_sheet(wb, eqSheet, '장비별 통계');
  }

  // User stats sheet
  if (lastStatsData.userStats && lastStatsData.userStats.length > 0) {
    const userData = lastStatsData.userStats.map(user => ({
      '사용자': user.username,
      '이메일': user.email,
      '총 예약': Number(user.total_reservations || 0),
      '확정': Number(user.confirmed_count || 0),
      '취소': Number(user.cancelled_count || 0),
      '총 시간(h)': parseFloat(parseFloat(user.total_hours || 0).toFixed(1))
    }));
    const userSheet = XLSX.utils.json_to_sheet(userData);
    XLSX.utils.book_append_sheet(wb, userSheet, '사용자별 통계');
  }

  // Generate filename with date
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const startDate = document.getElementById('statsStartDate')?.value;
  const endDate = document.getElementById('statsEndDate')?.value;
  let fileName;
  if (startDate && endDate) {
    fileName = `장비예약통계_${startDate}_${endDate}.xlsx`;
  } else {
    fileName = `장비예약통계_${dateStr}.xlsx`;
  }

  XLSX.writeFile(wb, fileName);
};

// Initialize admin page
document.addEventListener('DOMContentLoaded', () => {
  // Check admin access
  requireAdmin();

  // Load all data
  loadDashboardStats();
  loadEquipmentManagement();
  loadReservationManagement();
  loadStatistics();
});

// ===== Permission Management Functions =====

// Department label mapping
const getDepartmentLabel = (dept) => {
  const labels = {
    'nano_display': '나노디스플레이연구실',
    'nano_litho': '나노리소그래피연구센터',
    'battery': '이차전지장비연구실'
  };
  return labels[dept] || dept || '-';
};

// User role label mapping
const getUserRoleLabel = (role) => {
  const labels = {
    'intern': '인턴',
    'student': '학생연구원',
    'staff': '담당',
    'equipment_manager': '장비담당자',
    'admin': '관리자'
  };
  return labels[role] || role || '-';
};

// Open permission management modal
const openPermissionModal = async (equipmentId, equipmentName) => {
  document.getElementById('permissionEquipmentId').value = equipmentId;
  document.getElementById('permissionEquipmentName').textContent = equipmentName;

  // Load current permissions and candidates
  await loadPermissions(equipmentId);
  await loadPermissionCandidates(equipmentId);

  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('permissionModal'));
  modal.show();
};

// Load current permissions for equipment
const loadPermissions = async (equipmentId) => {
  const container = document.getElementById('permissionList');
  try {
    const permissions = await apiRequest(`/permissions/equipment/${equipmentId}`);

    if (permissions.length === 0) {
      container.innerHTML = '<tr><td colspan="5" class="text-center text-muted">권한자 없음</td></tr>';
    } else {
      container.innerHTML = permissions.map(p => `
        <tr>
          <td>${p.username}</td>
          <td>${getDepartmentLabel(p.department)}</td>
          <td>${getUserRoleLabel(p.user_role)}</td>
          <td>${new Date(p.granted_at).toLocaleDateString('ko-KR')}</td>
          <td>
            <button class="btn btn-sm btn-outline-danger" onclick="revokePermission(${equipmentId}, ${p.user_id})">
              <i class="bi bi-x"></i>
            </button>
          </td>
        </tr>
      `).join('');
    }
  } catch (error) {
    container.innerHTML = `<tr><td colspan="5" class="text-center text-danger">로드 실패: ${error.message}</td></tr>`;
  }
};

// Load users without permission (for granting)
const loadPermissionCandidates = async (equipmentId) => {
  const select = document.getElementById('permissionUserSelect');
  try {
    const users = await apiRequest(`/permissions/equipment/${equipmentId}/candidates`);

    select.innerHTML = '<option value="">사용자 선택...</option>' +
      users.map(u => `<option value="${u.id}">${u.username} (${getDepartmentLabel(u.department)}, ${getUserRoleLabel(u.user_role)})</option>`).join('');
  } catch (error) {
    select.innerHTML = '<option value="">로드 실패</option>';
  }
};

// Grant permission to user
const grantPermission = async () => {
  const equipmentId = document.getElementById('permissionEquipmentId').value;
  const userId = document.getElementById('permissionUserSelect').value;

  if (!userId) {
    alert('사용자를 선택해주세요.');
    return;
  }

  try {
    await apiRequest(`/permissions/equipment/${equipmentId}/grant`, {
      method: 'POST',
      body: JSON.stringify({ userId: parseInt(userId) })
    });

    // Refresh lists
    await loadPermissions(equipmentId);
    await loadPermissionCandidates(equipmentId);
  } catch (error) {
    alert('권한 부여 실패: ' + error.message);
  }
};

// Revoke permission from user
const revokePermission = async (equipmentId, userId) => {
  if (!confirm('이 사용자의 권한을 취소하시겠습니까?')) return;

  try {
    await apiRequest(`/permissions/equipment/${equipmentId}/revoke/${userId}`, {
      method: 'DELETE'
    });

    // Refresh lists
    await loadPermissions(equipmentId);
    await loadPermissionCandidates(equipmentId);
  } catch (error) {
    alert('권한 취소 실패: ' + error.message);
  }
};

// ===== Permission Summary Functions =====

// Load user permission summary
const loadUserPermissionSummary = async () => {
  const container = document.getElementById('userPermissionSummary');
  if (!container) return;

  try {
    const data = await apiRequest('/permissions/summary');
    const summary = data.userSummary || [];
    if (summary.length === 0) {
      container.innerHTML = '<tr><td colspan="5" class="text-center text-muted">일반 사용자 없음</td></tr>';
    } else {
      container.innerHTML = summary.map(u => `
        <tr>
          <td>${u.username}</td>
          <td>${getDepartmentLabel(u.department)}</td>
          <td>${getUserRoleLabel(u.user_role)}</td>
          <td><span class="badge bg-primary">${u.permission_count}</span></td>
          <td>
            <button class="btn btn-sm btn-outline-info" onclick="showUserPermissions(${u.id}, '${u.username}')">
              <i class="bi bi-eye"></i>
            </button>
          </td>
        </tr>
      `).join('');
    }
  } catch (error) {
    container.innerHTML = `<tr><td colspan="5" class="text-danger">로드 실패</td></tr>`;
  }
};

// Load equipment permission summary
const loadEquipmentPermissionSummary = async () => {
  const container = document.getElementById('equipmentPermissionSummary');
  if (!container) return;

  try {
    const data = await apiRequest('/permissions/summary');
    const summary = data.equipmentSummary || [];
    if (summary.length === 0) {
      container.innerHTML = '<tr><td colspan="4" class="text-center text-muted">장비 없음</td></tr>';
    } else {
      container.innerHTML = summary.map(e => `
        <tr>
          <td>${e.name}</td>
          <td>${e.manager_name || '-'}</td>
          <td><span class="badge bg-success">${e.permission_count}</span></td>
          <td>
            <button class="btn btn-sm btn-outline-info" onclick="openPermissionModal(${e.id}, '${e.name}')">
              <i class="bi bi-eye"></i>
            </button>
          </td>
        </tr>
      `).join('');
    }
  } catch (error) {
    container.innerHTML = `<tr><td colspan="4" class="text-danger">로드 실패</td></tr>`;
  }
};

// Show user's permissions in alert
const showUserPermissions = async (userId, username) => {
  try {
    const permissions = await apiRequest(`/permissions/user/${userId}`);

    if (permissions.length === 0) {
      alert(`${username}님은 권한이 부여된 장비가 없습니다.`);
    } else {
      const list = permissions.map(p => `- ${p.equipment_name} (${new Date(p.granted_at).toLocaleDateString('ko-KR')})`).join('\n');
      alert(`${username}님의 권한 목록:\n\n${list}`);
    }
  } catch (error) {
    alert('권한 조회 실패: ' + error.message);
  }
};

// Export all permissions to Excel
const exportPermissions = async () => {
  try {
    const permissions = await apiRequest('/permissions/export/all');

    if (permissions.length === 0) {
      alert('내보낼 권한 정보가 없습니다.');
      return;
    }

    // Format data for Excel
    const data = permissions.map(p => ({
      '장비명': p.equipment_name,
      '위치': p.location || '',
      '사용자': p.username,
      '이메일': p.email,
      '소속': getDepartmentLabel(p.department),
      '신분': getUserRoleLabel(p.user_role),
      '연수책임자': p.supervisor || '',
      '권한부여자': p.granted_by_name || '',
      '부여일': new Date(p.granted_at).toLocaleDateString('ko-KR')
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '권한현황');

    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `장비권한현황_${dateStr}.xlsx`);
  } catch (error) {
    alert('권한 내보내기 실패: ' + error.message);
  }
};

// ===== Manager Assignment Functions =====

// Open manager assignment modal (simple prompt version)
const openManagerModal = async (equipmentId, equipmentName) => {
  try {
    const candidates = await apiRequest('/equipment/managers/candidates');

    if (candidates.length === 0) {
      alert('담당자로 지정할 수 있는 사용자가 없습니다. (equipment_manager 또는 admin 역할 필요)');
      return;
    }

    const options = candidates.map((c, i) => `${i + 1}. ${c.username} (${getDepartmentLabel(c.department)})`).join('\n');
    const choice = prompt(`${equipmentName}의 담당자를 지정하세요:\n\n${options}\n\n번호 입력 (취소: 빈칸):`);

    if (!choice || choice.trim() === '') return;

    const idx = parseInt(choice) - 1;
    if (isNaN(idx) || idx < 0 || idx >= candidates.length) {
      alert('올바른 번호를 입력하세요.');
      return;
    }

    await apiRequest(`/equipment/${equipmentId}/manager`, {
      method: 'PUT',
      body: JSON.stringify({ managerId: candidates[idx].id })
    });

    alert(`${equipmentName}의 담당자가 ${candidates[idx].username}(으)로 지정되었습니다.`);
    loadEquipmentManagement();
    loadEquipmentPermissionSummary();
  } catch (error) {
    alert('담당자 지정 실패: ' + error.message);
  }
};



// ===== Initialize Admin Page =====
document.addEventListener('DOMContentLoaded', () => {
  // Check admin access
  requireAdmin();

  // Load all data
  loadDashboardStats();
  loadEquipmentManagement();
  loadReservationManagement();
  loadStatistics();

  // Load permission summaries
  loadUserPermissionSummary();
  loadEquipmentPermissionSummary();
});

